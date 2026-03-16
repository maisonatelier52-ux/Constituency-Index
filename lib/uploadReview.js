import net from 'net';

const DEFAULT_MAX_SCAN_BYTES = 25 * 1024 * 1024;

function asBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

async function fetchAssetBuffer(assetUrl) {
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Asset fetch failed with status ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || '0');
  const maxBytes = Number(process.env.MALWARE_SCAN_MAX_BYTES || DEFAULT_MAX_SCAN_BYTES);
  if (contentLength > maxBytes) {
    throw new Error(`Asset exceeds scan size limit (${maxBytes} bytes)`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length > maxBytes) {
    throw new Error(`Asset exceeds scan size limit (${maxBytes} bytes)`);
  }

  return buffer;
}

function scanWithClamav(buffer) {
  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT || '3310');
  if (!host || !port) {
    throw new Error('CLAMAV_HOST and CLAMAV_PORT are required for malware scanning');
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks = [];

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');

      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length, 0);
        socket.write(len);
        socket.write(chunk);
      }

      socket.write(Buffer.alloc(4));
    });

    socket.on('data', (data) => {
      chunks.push(data);
    });

    socket.on('end', () => {
      const reply = Buffer.concat(chunks).toString('utf8').trim();
      if (reply.includes('FOUND')) {
        resolve({
          clean: false,
          verdict: 'infected',
          raw: reply
        });
        return;
      }

      if (reply.includes('OK')) {
        resolve({
          clean: true,
          verdict: 'clean',
          raw: reply
        });
        return;
      }

      reject(new Error(`Unexpected ClamAV response: ${reply || 'empty'}`));
    });

    socket.on('error', reject);
  });
}

export async function scanUploadAsset({ assetUrl, publicId = null }) {
  const provider = String(process.env.MALWARE_SCAN_PROVIDER || 'noop').toLowerCase();
  if (provider === 'noop') {
    return {
      provider,
      scanned: false,
      verdict: 'skipped',
      publicId
    };
  }

  if (provider !== 'clamav') {
    throw new Error(`Unsupported malware scan provider: ${provider}`);
  }

  if (!assetUrl) {
    return {
      provider,
      scanned: false,
      verdict: 'skipped_no_asset'
    };
  }

  const buffer = await fetchAssetBuffer(assetUrl);
  const result = await scanWithClamav(buffer);

  return {
    provider,
    scanned: true,
    publicId,
    assetUrl,
    ...result
  };
}

export async function moderateUploadAsset({ assetUrl, publicId = null }) {
  const provider = String(process.env.MODERATION_PROVIDER || 'noop').toLowerCase();
  if (provider === 'noop') {
    return {
      provider,
      moderated: false,
      verdict: 'skipped',
      publicId
    };
  }

  if (provider !== 'sightengine') {
    throw new Error(`Unsupported moderation provider: ${provider}`);
  }

  if (!assetUrl) {
    return {
      provider,
      moderated: false,
      verdict: 'skipped_no_asset'
    };
  }

  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!apiUser || !apiSecret) {
    throw new Error('SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET are required for moderation');
  }

  const models = process.env.SIGHTENGINE_MODELS || 'nudity-2.1,weapon,violence,gore';
  const threshold = Number(process.env.MODERATION_REVIEW_THRESHOLD || '0.65');
  const form = new URLSearchParams({
    url: assetUrl,
    models,
    api_user: apiUser,
    api_secret: apiSecret
  });

  const response = await fetch('https://api.sightengine.com/1.0/check.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });

  if (!response.ok) {
    throw new Error(`Moderation provider returned ${response.status}`);
  }

  const payload = await response.json();
  const scores = {
    nudity: Number(payload?.nudity?.raw || 0),
    weapon: Number(payload?.weapon || 0),
    violence: Number(payload?.violence?.prob || payload?.violence || 0),
    gore: Number(payload?.gore?.prob || payload?.gore || 0)
  };
  const maxScore = Math.max(...Object.values(scores));

  return {
    provider,
    moderated: true,
    publicId,
    assetUrl,
    verdict: maxScore >= threshold ? 'review_required' : 'approved',
    threshold,
    scores,
    raw: payload
  };
}

export function uploadsHardeningEnabled() {
  return {
    malware: !asBool(process.env.DISABLE_MALWARE_SCAN),
    moderation: !asBool(process.env.DISABLE_CONTENT_MODERATION)
  };
}
