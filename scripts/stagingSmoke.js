/* eslint-disable no-console */
const crypto = require('crypto');

function must(value, name) {
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

class CookieJar {
  constructor() {
    this.map = new Map();
  }

  ingestFromHeaders(headers) {
    const setCookie = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
    if (setCookie.length > 0) {
      setCookie.forEach((raw) => this.ingest(raw));
      return;
    }

    const single = headers.get('set-cookie');
    if (single) this.ingest(single);
  }

  ingest(raw) {
    const part = String(raw || '').split(';')[0];
    const eq = part.indexOf('=');
    if (eq <= 0) return;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) this.map.set(key, val);
  }

  header() {
    return Array.from(this.map.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return { _raw: text };
  }
}

async function getJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const body = await readJson(res);
  return { res, body };
}

function assertStatus(actual, expected, context) {
  if (actual !== expected) {
    throw new Error(`${context}: expected ${expected}, got ${actual}`);
  }
}

async function login(baseUrl, email, password) {
  const jar = new CookieJar();

  const csrfResp = await fetch(`${baseUrl}/api/auth/csrf`);
  jar.ingestFromHeaders(csrfResp.headers);
  const csrfBody = await readJson(csrfResp);
  assertStatus(csrfResp.status, 200, 'csrf fetch');
  const csrfToken = csrfBody.csrfToken;
  if (!csrfToken) throw new Error('csrf token missing');

  const form = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${baseUrl}/constituencies`,
    json: 'true'
  });

  const loginResp = await fetch(`${baseUrl}/api/auth/callback/credentials?json=true`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: jar.header()
    },
    body: form.toString(),
    redirect: 'manual'
  });
  jar.ingestFromHeaders(loginResp.headers);
  const loginBody = await readJson(loginResp);
  if (loginResp.status !== 200) {
    throw new Error(`credentials login failed with ${loginResp.status}`);
  }
  if (loginBody?.error) {
    throw new Error(`credentials login error: ${loginBody.error}`);
  }

  const sessionResp = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: jar.header() }
  });
  const sessionBody = await readJson(sessionResp);
  assertStatus(sessionResp.status, 200, 'session fetch');
  if (!sessionBody?.user?.email) {
    throw new Error('session user missing after login');
  }

  return { jar, session: sessionBody };
}

async function run() {
  const baseUrl = must(process.env.SMOKE_BASE_URL, 'SMOKE_BASE_URL').replace(/\/$/, '');
  const summary = [];

  async function step(name, fn) {
    try {
      await fn();
      summary.push({ name, ok: true });
      console.log(`[PASS] ${name}`);
    } catch (error) {
      summary.push({ name, ok: false, error: error.message });
      console.error(`[FAIL] ${name}: ${error.message}`);
      throw error;
    }
  }

  let createdIssueId = null;

  await step('health', async () => {
    const { res, body } = await getJson(`${baseUrl}/api/health`);
    assertStatus(res.status, 200, 'health');
    if (body?.status !== 'ok') throw new Error('health status not ok');
  });

  await step('dashboard overview', async () => {
    const { res } = await getJson(`${baseUrl}/api/dashboard/overview?country=US`);
    assertStatus(res.status, 200, 'dashboard');
  });

  await step('issues heatmap', async () => {
    const { res } = await getJson(`${baseUrl}/api/issues/heatmap`);
    assertStatus(res.status, 200, 'issues heatmap');
  });

  await step('geocode lookup', async () => {
    const { res } = await getJson(`${baseUrl}/api/geocode/lookup?mode=postal&country=US&postalCode=10001`);
    assertStatus(res.status, 200, 'geocode lookup');
  });

  const testEmail = process.env.SMOKE_TEST_EMAIL || '';
  const testPassword = process.env.SMOKE_TEST_PASSWORD || '';
  if (testEmail && testPassword) {
    await step('citizen login + issue create + upload signature', async () => {
      const { jar } = await login(baseUrl, testEmail, testPassword);
      const cookie = jar.header();

      const uploadRes = await fetch(`${baseUrl}/api/uploads/signature`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie
        },
        body: JSON.stringify({ folder: 'issues/evidence' })
      });
      assertStatus(uploadRes.status, 200, 'upload signature');

      const issueRes = await fetch(`${baseUrl}/api/issues`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie
        },
        body: JSON.stringify({
          category: 'Infrastructure',
          description: `Smoke issue ${Date.now()}`,
          location: 'Smoke test',
          latitude: 40.7128,
          longitude: -74.006
        })
      });
      const issueBody = await readJson(issueRes);
      assertStatus(issueRes.status, 201, 'issue create');
      createdIssueId = issueBody?.issue?._id || null;
    });
  } else {
    console.log('[SKIP] authenticated citizen checks (set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD)');
  }

  const adminEmail = process.env.SMOKE_ADMIN_EMAIL || '';
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || '';
  if (adminEmail && adminPassword && createdIssueId) {
    await step('admin login + issue update', async () => {
      const { jar } = await login(baseUrl, adminEmail, adminPassword);
      const cookie = jar.header();
      const res = await fetch(`${baseUrl}/api/issues/${createdIssueId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie
        },
        body: JSON.stringify({ status: 'in_progress', statusNote: 'staging smoke update' })
      });
      assertStatus(res.status, 200, 'issue update');
    });
  } else {
    console.log('[SKIP] admin issue update checks (needs SMOKE_ADMIN_EMAIL/PASSWORD and created issue)');
  }

  const workerSecret = process.env.JOB_WORKER_SECRET || '';
  if (workerSecret) {
    await step('queue worker trigger', async () => {
      const { res } = await getJson(`${baseUrl}/api/jobs/worker`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-worker-secret': workerSecret
        },
        body: JSON.stringify({ limit: 30, workerId: `staging-smoke-${crypto.randomUUID()}` })
      });
      assertStatus(res.status, 200, 'worker trigger');
    });
  } else {
    console.log('[SKIP] queue worker trigger (set JOB_WORKER_SECRET)');
  }

  console.log('\nSmoke Summary');
  summary.forEach((item) => {
    console.log(`- ${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.error ? `: ${item.error}` : ''}`);
  });
}

run().catch((error) => {
  console.error(`staging smoke failed: ${error.message}`);
  process.exit(1);
});
