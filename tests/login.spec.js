import { test, expect } from '@playwright/test';

test.describe('Login RBAC smoke tests', () => {
  const BASE = process.env.BASE_URL || 'http://localhost:3001';
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('login-header').waitFor({ timeout: 15000 });
  });

  test('RRHH login should succeed and store rrhh user', async ({ page }) => {
    await page.getByTestId('role-rrhh').click();
    await page.fill('[data-testid="login-identifier"]', 'rrhh');
    await page.fill('[data-testid="login-password"]', 'rrhh');
    await page.getByTestId('login-submit').click();
    await page.waitForTimeout(800);
    const user = await page.evaluate(() => {
      const s = localStorage.getItem('ven_nomina_session_user') || sessionStorage.getItem('ven_nomina_session_user');
      return s ? JSON.parse(s) : null;
    });
    expect(user).not.toBeNull();
    expect(user.rol).toBe('rrhh');
  });

  test('Dueño login with admin credentials must fail (role mismatch)', async ({ page }) => {
    await page.getByTestId('role-dueno').click();
    await page.fill('[data-testid="login-identifier"]', 'admin');
    await page.fill('[data-testid="login-password"]', 'admin');
    await page.getByTestId('login-submit').click();
    // Expect an error to be shown due to role mismatch
    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('Admin login should succeed and store admin user', async ({ page }) => {
    await page.getByTestId('role-admin').click();
    await page.fill('[data-testid="login-identifier"]', 'admin');
    await page.fill('[data-testid="login-password"]', 'admin');
    await page.getByTestId('login-submit').click();
    await page.waitForTimeout(800);
    const user = await page.evaluate(() => {
      const s = localStorage.getItem('ven_nomina_session_user') || sessionStorage.getItem('ven_nomina_session_user');
      return s ? JSON.parse(s) : null;
    });
    expect(user).not.toBeNull();
    expect(user.rol).toBe('admin_sistema');
  });
});
