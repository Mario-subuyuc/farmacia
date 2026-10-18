import { test, expect } from '@playwright/test';

test('catálogo público: filtros reales, sucursales y login sin registro', async ({ page }) => {
  const tokens = [];
  page.on('request', request => { if (request.url().includes('/api/catalogo')) tokens.push(request.headers().authorization); });
  await page.goto('/#catalogo');
  await expect(page.getByRole('heading', { name: 'Catálogo de medicamentos' })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(12);
  await page.getByRole('link', { name: 'Ir al catálogo', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#catalog-content')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Catálogo de medicamentos' })).toBeVisible();
  await page.screenshot({ path: 'test-results/catalog-desktop.png', fullPage: true });
  await page.getByLabel('Buscar producto o principio activo').fill('paracetamol');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByLabel('Sucursal', { exact: true }).selectOption('2');
  await page.getByText('Ver sucursales disponibles', { exact: true }).click();
  await expect(page.locator('.product-branch')).toHaveCount(1);
  await expect(page.locator('.product-branch')).toContainText('Mixco');
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await page.getByLabel('Categoría', { exact: true }).selectOption('ANTIBIOTICO');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Amoxicilina 500 mg' })).toBeVisible();
  await expect(page.getByText('Requiere receta médica', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Acceso del personal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toHaveCount(0);
  expect(tokens.length).toBeGreaterThan(0);
  expect(tokens.every(token => !token)).toBe(true);
});

test('catálogo móvil y navegación de todos los módulos internos', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#catalogo');
  await expect(page.locator('.product-card')).toHaveCount(12);
  await page.screenshot({ path: 'test-results/catalog-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Acceso del personal', exact: true }).click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu red, en un solo lugar.' })).toBeVisible();
  for (const name of ['Inventario', 'Ventas', 'Pedidos y entregas', 'Traslados', 'Caja y movimientos', 'Planilla', 'Reportes',
    'Contenido del sitio', 'Cupones', 'Notificaciones', 'Sucursales', 'Medicamentos', 'Clientes', 'Empleados', 'Activos fijos', 'Stock mínimo', 'Accesos y permisos', 'Movimientos de stock', 'Auditoría']) {
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
    await expect(page.locator('.loading')).toHaveCount(0);
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Accesos y permisos', exact: true }).click();
  await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Correo electrónico', { exact: false })).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Contraseña', { exact: false })).toHaveAttribute('type', 'password');
});
