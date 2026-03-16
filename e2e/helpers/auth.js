const { expect } = require('@playwright/test');

async function registerAndVerifyCitizen(request, email, password, name = 'E2E Citizen') {
  const registerResponse = await request.post('/api/auth/register', {
    data: { name, email, password }
  });
  expect(registerResponse.ok()).toBeTruthy();
  const registerPayload = await registerResponse.json();

  if (registerPayload.devVerificationToken) {
    const verifyResponse = await request.post('/api/auth/verify-email', {
      data: { token: registerPayload.devVerificationToken }
    });
    expect(verifyResponse.ok()).toBeTruthy();
  }
}

async function loginViaUi(page, email, password) {
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

module.exports = {
  registerAndVerifyCitizen,
  loginViaUi
};
