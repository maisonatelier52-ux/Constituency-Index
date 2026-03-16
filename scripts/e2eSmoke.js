const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

async function must(url, expected = 200) {
  const response = await fetch(`${baseUrl}${url}`, { redirect: 'manual' });
  if (response.status !== expected) {
    throw new Error(`${url} expected ${expected} but got ${response.status}`);
  }
  return response;
}

async function main() {
  await must('/api/health', 200);
  await must('/api/metrics', 200);
  await must('/api/mps?state=Kerala', 200);
  await must('/api/mps/facets?state=Kerala', 200);

  const protectedPage = await fetch(`${baseUrl}/mps?officeLevel=mla`, { redirect: 'manual' });
  if (![200, 307].includes(protectedPage.status)) {
    throw new Error(`/mps?officeLevel=mla expected 200 or 307 but got ${protectedPage.status}`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      baseUrl,
      checked: ['/api/health', '/api/metrics', '/api/mps?state=Kerala', '/api/mps/facets?state=Kerala', '/mps?officeLevel=mla']
    })
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
});
