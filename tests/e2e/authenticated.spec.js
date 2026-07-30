import { test, expect } from '@playwright/test';

const email = process.env.GP_TEST_EMAIL;
const password = process.env.GP_TEST_PASSWORD;

test.describe('authenticated development account', () => {
  test.skip(!email || !password, 'GP_TEST_EMAIL and GP_TEST_PASSWORD are required');

  test('logs in, loads relational data, navigates, and logs out', async ({ page }) => {
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });

    await page.goto('/');
    await expect(page.locator('#auth-overlay')).toBeVisible();
    await page.locator('#auth-login-email').fill(email);
    await page.locator('#auth-login-password').fill(password);
    await page.locator('#btn-auth-login').click();

    await expect(page.locator('#auth-overlay')).toBeHidden({ timeout: 20_000 });
    await expect(page.locator('#header-family-name')).not.toHaveText('', { timeout: 20_000 });
    await expect(page.locator('#missions-board')).toBeVisible();
    await expect(page.locator('#car-avatar')).toBeVisible();

    await page.locator('#tab-week').click();
    await expect(page.locator('#panel-week')).toBeVisible();
    await expect(page.locator('#week-days')).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.locator('#btn-logout').click();
    await expect(page.locator('#auth-overlay')).toBeVisible();

    expect(browserErrors).toEqual([]);
  });
});
