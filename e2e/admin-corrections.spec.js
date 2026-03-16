const { test, expect } = require('@playwright/test');
const { loginViaUi } = require('./helpers/auth');

test('admin can open corrections and queue a Kerala import', async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, 'Admin credentials are required for admin e2e.');

  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  await page.goto('/admin/corrections');
  await expect(page.getByRole('heading', { name: /corrections/i })).toBeVisible();

  await page.route('**/api/admin/jobs', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          job: {
            _id: '507f1f77bcf86cd799439011',
            type: 'import.representatives',
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            createdAt: new Date().toISOString()
          }
        })
      });
      return;
    }
    await route.fallback();
  });

  await page.getByRole('button', { name: /re-run kerala import/i }).click();
  await expect(page.getByText(/queued/i)).toBeVisible();
});
