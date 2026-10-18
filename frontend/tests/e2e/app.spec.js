import { test, expect } from '@playwright/test';

test('correo: vuelve al login y limpia el fragmento de Auth', async ({ page }) => {
  await page.goto('/#access_token=token-de-prueba&refresh_token=refresh-de-prueba&type=signup');
  await expect(page.getByText(/Correo confirmado\. Inicia sesión/)).toBeVisible();
  await expect(page).toHaveURL(/\/#inicio$/);
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  await page.goto('/#error=access_denied&error_code=otp_expired');
  await expect(page.getByText(/El enlace de confirmación venció/)).toBeVisible();
  await expect(page).toHaveURL(/\/#inicio$/);
});

async function login(page) {
  await page.goto('/#login');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu red, en un solo lugar.' })).toBeVisible();
}
async function navigate(page, name) {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  await expect(page.locator('.loading')).toHaveCount(0);
}

test('React y API: login, cliente, medicamento, venta, anulación y sesión restaurada', async ({ page }) => {
  await login(page);
  await navigate(page, 'Clientes');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Código').fill('E2E-CLI');
  await dialog.getByLabel('Nombre', { exact: false }).fill('Cliente React');
  await dialog.getByLabel('Apellido').fill('Prueba');
  await dialog.getByLabel('Teléfono').fill('55550000');
  await dialog.getByLabel('Dirección').fill('Dirección de prueba');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cliente React', { exact: true })).toBeVisible();
  await navigate(page, 'Medicamentos');
  await page.getByRole('button', { name: 'Editar medicamento 1', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Precio de venta').fill('11');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page, 'Ventas');
  await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Sucursal', { exact: false }).selectOption('1');
  await page.getByLabel('Medicamento 1', { exact: true }).selectOption('1');
  await page.getByLabel('Unidades 1', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Registrar venta: operación completada/)).toBeVisible();
  await page.getByRole('button', { name: 'Anular venta', exact: true }).first().click();
  await page.getByLabel('Motivo').fill('Prueba de anulación React');
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await page.getByRole('button',{name:'Sí, aplicar operación'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Anulada', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ventas', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Salir de esta pestaña' }).click();
  await page.getByRole('button', { name: 'Acceso del personal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
});

test('React y API: call center crea pedido y la sucursal confirma entrega', async ({ page }) => {
  await login(page); await navigate(page, 'Call center');
  await page.getByLabel('Latitud', { exact: false }).fill('14.6407');
  await page.getByLabel('Longitud', { exact: false }).fill('-90.5133');
  await page.getByLabel('Medicamento 1', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Consultar disponibilidad' }).click();
  await expect(page.getByText('Menor tiempo estimado')).toBeVisible();
  await page.getByRole('button', { name: 'Crear pedido en esta sucursal' }).first().click();
  await page.getByRole('dialog').getByLabel('Cliente', { exact: false }).selectOption('1');
  await page.getByRole('dialog').getByLabel('Dirección de entrega').fill('Zona 1, Guatemala');
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Crear pedido: operación completada/)).toBeVisible();
  await navigate(page, 'Pedidos y entregas');
  await page.getByRole('button', { name: 'Preparar pedido', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Despachar pedido', exact: true }).first().click();
  await page.getByLabel('Nombre del repartidor').fill('Repartidor React');
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
});

test('React y API: entrada, traslado, recepción, caja, planilla y reporte', async ({ page }) => {
  await login(page);
  await navigate(page, 'Inventario');
  await page.getByRole('button', { name: 'Registrar entrada', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Sucursal', { exact: false }).selectOption('1');
  await page.getByRole('dialog').getByLabel('Medicamento', { exact: false }).selectOption('1');
  await page.getByLabel('Código del lote').fill('E2E-LOTE');
  await page.getByLabel('Fecha de vencimiento').fill('2030-12-31');
  await page.getByLabel('Unidades recibidas').fill('20');
  await page.getByLabel('Motivo').fill('Recepción de prueba React');
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('E2E-LOTE', { exact: true })).toBeVisible();
  await navigate(page, 'Traslados');
  await page.getByRole('button', { name: 'Crear traslado', exact: true }).click();
  await page.getByLabel('Sucursal origen', { exact: false }).selectOption('1');
  await page.getByLabel('Sucursal destino', { exact: false }).selectOption('2');
  await page.getByLabel('Motivo').fill('Traslado de prueba React');
  await page.getByLabel('Medicamento 1', { exact: true }).selectOption('1');
  await page.getByLabel('Unidades 1', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar recepción', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Recibido', { exact: true })).toBeVisible();
  await navigate(page, 'Caja y movimientos');
  await page.getByRole('button', { name: 'Registrar movimiento', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Sucursal', { exact: false }).selectOption('1');
  await page.getByLabel('Concepto').fill('Gasto de prueba React');
  await page.getByLabel('Monto (Q)').fill('12');
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Gasto de prueba React', { exact: true })).toBeVisible();
  await navigate(page, 'Planilla');
  await page.getByRole('button', { name: 'Pagar planilla', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Sucursal', { exact: false }).selectOption('1');
  await page.getByLabel('Mes de pago').fill('2026-09');
  await page.getByRole('button', { name: 'Confirmar operación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Pagar planilla: operación completada/)).toBeVisible();
  await navigate(page, 'Reportes');
  await expect(page.getByRole('button', { name: /Exportar Excel/ })).toBeVisible();
});

test('celular: navegación, tablas contenidas y modal sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Tu red, en un solo lugar.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await navigate(page, 'Inventario');
  await page.getByRole('button', { name: 'Registrar entrada' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Cerrar ventana' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});