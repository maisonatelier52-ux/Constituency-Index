const { test, expect } = require('@playwright/test');
const { loginViaUi, registerAndVerifyCitizen } = require('./helpers/auth');

test('citizen can submit an issue with uploaded evidence', async ({ page, request }) => {
  const email = `issue.${Date.now()}@example.com`;
  const password = 'StrongPass123!';

  await registerAndVerifyCitizen(request, email, password);
  await loginViaUi(page, email, password);
  await page.goto('/issues/new');

  await page.route('**/api/uploads/signature', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cloudName: 'demo',
        apiKey: 'key',
        timestamp: Math.floor(Date.now() / 1000),
        folder: 'issues',
        signature: 'sig',
        allowedFormats: ['png'],
        maxFileSize: 1024 * 1024,
        maxFiles: 5
      })
    });
  });

  await page.route('https://api.cloudinary.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.png' })
    });
  });

  await page.getByLabel(/category/i).fill('Roads');
  await page.getByLabel(/description/i).fill('There is a pothole near the main junction.');
  await page.getByLabel(/location/i).fill('Kochi');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'evidence.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-image-data')
  });
  await page.getByRole('button', { name: /submit issue/i }).click();

  await expect(page.getByText(/issue reported successfully/i)).toBeVisible();
});
