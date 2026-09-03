const { test, expect } = require('@playwright/test');

test.describe('Login RBAC smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('RRHH login should succeed and store rrhh user', async ({ page }) => {
    await page.click('text=Gerente de RRHH');
    await page.fill('input[placeholder="Ej. admin, rrhh, dueno"]', 'rrhh');
    await page.fill('input[placeholder="Contraseña"]', 'rrhh');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(800);
    const user = await page.evaluate(() => {
      const s = localStorage.getItem('ven_nomina_session_user') || sessionStorage.getItem('ven_nomina_session_user');
      return s ? JSON.parse(s) : null;
    });
    expect(user).not.toBeNull();
    expect(user.rol).toBe('rrhh');
  });

  test('Dueño login with admin credentials must fail (role mismatch)', async ({ page }) => {
    await page.click('text=Dueño de la Empresa');
    await page.fill('input[placeholder="Ej. admin, rrhh, dueno"]', 'admin');
    await page.fill('input[placeholder="Contraseña"]', 'admin');
    await page.click('button[type="submit"]');
    // Expect an error mentioning perfil seleccionado
    await expect(page.locator('text=perfil seleccionado')).toHaveCount(1);
  });

  test('Admin login should succeed and store admin user', async ({ page }) => {
    await page.click('text=Administrador del Sistema');
    await page.fill('input[placeholder="Ej. admin, rrhh, dueno"]', 'admin');
    await page.fill('input[placeholder="Contraseña"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(800);
    const user = await page.evaluate(() => {
      const s = localStorage.getItem('ven_nomina_session_user') || sessionStorage.getItem('ven_nomina_session_user');
      return s ? JSON.parse(s) : null;
    });
    expect(user).not.toBeNull();
    expect(user.rol).toBe('admin_sistema');
  });
});
