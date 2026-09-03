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
    // submit and wait for /api/login response
    const [resp1] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/login')),
      page.getByTestId('login-submit').click(),
    ]);
    expect(resp1.status()).toBe(200);
    // wait for client to store user in local/session storage
    await page.waitForFunction(() => !!(localStorage.getItem('ven_nomina_session_user') || sessionStorage.getItem('ven_nomina_session_user')),{ timeout: 2000 });
    const user = await page.evaluate(() => {
      const s = localStorage.getItem('ven_nomina_session_user') || sessionStorage.getItem('ven_nomina_session_user');
      return s ? JSON.parse(s) : null;
    });
    expect(user).not.toBeNull();
    expect(user.rol).toBe('rrhh');
  });

  test('Dueño login with admin credentials must fail (role mismatch)', async ({ page }) => {
    await page.getByTestId('role-dueno').click();
<<<<<<< HEAD
    await page.fill('[data-testid="login-identifier"]', 'psinza');
    await page.fill('[data-testid="login-password"]', 'psinza');
=======
    await page.fill('[data-testid="login-identifier"]', 'admin');
    await page.fill('[data-testid="login-password"]', 'admin');
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
    const [resp2] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/login')),
      page.getByTestId('login-submit').click(),
    ]);
    expect(resp2.status()).toBe(403);
    // Error block should appear
    await page.getByTestId('login-error').waitFor({ state: 'visible' });
    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('Admin login should succeed and store admin user', async ({ page }) => {
    await page.getByTestId('role-admin').click();
<<<<<<< HEAD
    await page.fill('[data-testid="login-identifier"]', 'psinza');
    await page.fill('[data-testid="login-password"]', 'psinza');
=======
    await page.fill('[data-testid="login-identifier"]', 'admin');
    await page.fill('[data-testid="login-password"]', 'admin');
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
    const [resp3] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/login')),
      page.getByTestId('login-submit').click(),
    ]);
    expect(resp3.status()).toBe(200);
    await page.waitForFunction(() => !!(localStorage.getItem('ven_nomina_session_user') || sessionStorage.getItem('ven_nomina_session_user')),{ timeout: 2000 });
    const user = await page.evaluate(() => {
      const s = localStorage.getItem('ven_nomina_session_user') || sessionStorage.getItem('ven_nomina_session_user');
      return s ? JSON.parse(s) : null;
    });
    expect(user).not.toBeNull();
    expect(user.rol).toBe('admin_sistema');
  });
});
