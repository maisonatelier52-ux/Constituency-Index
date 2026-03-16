const https = require('https');

const options = {
  hostname: 'constituency-index.vercel.app',
  path: '/api/jobs/worker',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-worker-secret': 'workersecret123'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log('Status:', res.statusCode, '\nResponse:', data); });
});

req.on('error', (e) => { console.error('Error:', e.message); });
req.end();