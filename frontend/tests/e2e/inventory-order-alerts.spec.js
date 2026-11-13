import { test, expect } from '@playwright/test';

test('inventario distingue vencimientos y faltantes; pedidos nuevos generan avisos', async ({
  page,
}) => {
  let pending = [];
  await page.route('**/api/pedidos?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('estado') !== 'PENDIENTE')
      return route.continue();
    await route.fulfill({
      json: { data: pending, pagination: { total: pending.length, page: 1, limit: 100 } },
    });
  });
  await page.route('**/api/inventario?**', async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    const day = new Date();
    const date = (days) => {
      const d = new Date(day);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    result.data = result.data
      .slice(0, 3)
      .map((row, i) => ({
        ...row,
        cantidad: i === 2 ? 0 : 10,
        reservado: 0,
        fecha_vencimiento: date([-1, 10, 100][i]),
      }));
    await route.fulfill({ json: result });
  });
  await page.goto('/#login');
  await page.getByLabel('Correo electrónico').fill('admin@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.getByLabel('Buscar módulo').fill('inventario');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Inventario', exact: true })
    .click();
  await expect(page.locator('tr.inventory-expired')).toHaveCount(1);
  await expect(page.locator('tr.inventory-expiring')).toHaveCount(1);
  await expect(page.locator('tr.inventory-empty')).toContainText('Sin unidades disponibles');
  pending = [{ id_pedido: 9999, estado: 'PENDIENTE', id_sucursal: 1 }];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.order-alert-banner')).toContainText('1 pedido(s)');
  await page.getByRole('button', { name: 'Abrir avisos y preferencias' }).click();
  await expect(page.locator('.feedback-history')).toContainText('pedido(s) pendiente(s)');
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  pending = [];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.order-alert-banner')).toHaveCount(0);
});
