const { test, expect } = require('@playwright/test');
const { loginViaUi } = require('./helpers/auth');

test('admin can view jobs and trigger worker', async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, 'Admin credentials are required for admin e2e.');

  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);

  await page.route('**/api/jobs/worker', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        summary: { claimed: 1, succeeded: 1, failed: 0, deadLettered: 0 }
      })
    });
  });

  await page.goto('/admin/jobs');
  await expect(page.getByRole('heading', { name: /queue diagnostics/i })).toBeVisible();
  await page.getByRole('button', { name: /run worker/i }).click();
  await expect(page.getByText(/worker: claimed 1, succeeded 1/i)).toBeVisible();
});
