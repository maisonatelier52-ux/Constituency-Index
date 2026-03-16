const { test, expect } = require('@playwright/test');
const { loginViaUi, registerAndVerifyCitizen } = require('./helpers/auth');

test('citizen can register, verify, and sign in', async ({ page, request }) => {
  const email = `citizen.${Date.now()}@example.com`;
  const password = 'StrongPass123!';

  await registerAndVerifyCitizen(request, email, password);
  await loginViaUi(page, email, password);

  await expect(page).toHaveURL(/\/constituencies/);
  await expect(page.getByText(/constituency overview/i)).toBeVisible();
});
