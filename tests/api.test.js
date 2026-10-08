import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, asUser, testSupabase, accounts } from './database-helper.js';

// Los tests no necesitan .env ni hacen peticiones a Supabase remoto.
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
process.env.CORS_ORIGINS = 'http://localhost:5173';
const { createApp } = await import('../src/app.js');
const { createAuthenticate } = await import('../src/middlewares/auth.middleware.js');
const { default: User } = await import('../src/models/user.model.js');

test('API HTTP completa con SQL local y Auth remoto simulado', async function (t) {
  const db = await testDatabase();
  const client = testSupabase(db);
  const middleware = createAuthenticate(function (token) {
    return { ...client, auth: { getUser: async function () {
      if (accounts[token]) return { data: { user: { id: accounts[token] } }, error: null };
      return { data: { user: null }, error: { status: 401 } };
    } } };
  });
  const app = createApp({ authenticate: middleware, logger: false });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async function () { await new Promise(resolve => server.close(resolve)); await db.close(); });
  const root = `http://127.0.0.1:${server.address().port}/api`;
  async function request(method, path, body, expected, account = 'admin', extraHeaders = {}) {
    return asUser(db, account === 'bad-token' || !account ? 'unassigned' : account, async function () {
      const headers = { 'Content-Type': 'application/json', ...extraHeaders };
      if (account) headers.Authorization = `Bearer ${account}`;
      if (!['GET', 'OPTIONS'].includes(method) && headers['Idempotency-Key'] === undefined) headers['Idempotency-Key'] = crypto.randomUUID();
      const response = await fetch(root + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await response.text();
      const result = text ? JSON.parse(text) : null;
      assert.equal(response.status, expected, `${method} ${path}: ${text}`);
      return { result, response };
    });
  }
  const sale = { id_sucursal: 1, metodo_pago: 'EFECTIVO', items: [{ id_medicamento: 1, cantidad: 2 }] };
  const order = { id_sucursal: 1, id_cliente: 1, metodo_pago: 'EFECTIVO', canal: 'TELEFONO', direccion_entrega: 'Demo',
    latitud: 14.6407, longitud: -90.5133, items: [{ id_medicamento: 1, cantidad: 2 }] };

  await t.test('health público; token obligatorio, token inválido y perfil sin asignar', async function () {
    await request('GET', '/health', undefined, 200, null);
    await request('GET', '/sucursales', undefined, 401, null);
    await request('GET', '/sucursales', undefined, 401, 'bad-token');
    await request('GET', '/sucursales', undefined, 403, 'unassigned');
    const { result } = await request('GET', '/me', undefined, 200, 'manager');
    assert.equal(result.data.rol, 'GERENTE');
    assert.equal(result.data.id_sucursal, 1);
  });
  await t.test('CORS permite React y rechaza orígenes ajenos', async function () {
    const { response } = await request('OPTIONS', '/ventas', undefined, 204, null, { Origin: 'http://localhost:5173' });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    await request('GET', '/health', undefined, 403, null, { Origin: 'https://untrusted.example' });
  });
  await t.test('listados paginados, filtros seguros, IDs inválidos y ruta inexistente', async function () {
    const { result } = await request('GET', '/medicamentos?page=1&limit=2', undefined, 200);
    assert.equal(result.data.length, 2);
    assert.equal(result.pagination.total, 3);
    await request('GET', '/medicamentos?limit=101', undefined, 400);
    await request('GET', '/medicamentos?select=salario', undefined, 400);
    await request('GET', '/medicamentos/no-es-id', undefined, 400);
    await request('GET', '/medicamentos/9999', undefined, 404);
    await request('GET', '/no-existe', undefined, 404);
  });
  await t.test('CRUD sucursales y medicamentos; solo administrador modifica catálogos globales', async function () {
    const { result: branch } = await request('POST', '/sucursales', { codigo: 'HTTP-SUC', nombre: 'Sucursal HTTP', departamento: 'Guatemala',
      direccion: 'Dirección demo', tipo: 'STAND', latitud: 14.64, longitud: -90.51 }, 201);
    await request('PATCH', `/sucursales/${branch.data.id_sucursal}`, { acepta_pedidos: false }, 200);
    await request('POST', '/sucursales', {}, 403, 'manager');
    const { result: med } = await request('POST', '/medicamentos', { codigo: 'HTTP-MED', nombre: 'Demo HTTP', categoria: 'DEMO',
      principio_activo: 'Demo', precio_compra: 2, precio_venta: 5 }, 201);
    await request('PATCH', `/medicamentos/${med.data.id_medicamento}`, { estado: 'INACTIVO' }, 200);
    await request('PATCH', '/medicamentos/1', { precio_venta: 1 }, 403, 'vendor');
    await request('POST', '/medicamentos', { codigo: 'FAIL' }, 400);
  });
  await t.test('CRUD empleados, clientes, activos, stock mínimo y perfiles', async function () {
    const { result: employee } = await request('POST', '/empleados', { codigo: 'HTTP-EMP', id_sucursal: 1, nombre: 'Persona', apellido: 'Demo', puesto: 'VENTAS', salario: 3000 }, 201, 'manager');
    await request('PATCH', `/empleados/${employee.data.id_empleado}`, { salario: 3100 }, 200, 'manager');
    await request('POST', '/empleados', { codigo: 'AJENO', id_sucursal: 2, nombre: 'A', apellido: 'B', puesto: 'C', salario: 3000 }, 403, 'manager');
    const { result: customer } = await request('POST', '/clientes', { codigo: 'HTTP-CLI', nombre: 'Ana', apellido: 'Demo', telefono: '55550100', direccion: 'Demo', email: 'ana@example.com' }, 201, 'callCenter');
    await request('PATCH', `/clientes/${customer.data.id_cliente}`, { telefono: '55550200' }, 200, 'callCenter');
    await request('POST', '/clientes', { codigo: 'HTTP-BAD', nombre: 'Ana', apellido: 'Demo', telefono: '5555', direccion: 'Demo', email: 'bad' }, 400);
    const { result: asset } = await request('POST', '/activos', { codigo: 'HTTP-ACT', id_sucursal: 1, nombre: 'Equipo', valor: 1000, vida_util_meses: 60, fecha_adquisicion: '2026-01-01' }, 201, 'manager');
    await request('PATCH', `/activos/${asset.data.id_activo}`, { estado: 'MANTENIMIENTO' }, 200);
    await request('PATCH', '/activos/1', { fecha_adquisicion: '2026-02-31' }, 400);
    await request('PATCH', '/stock-minimos/1', { stock_minimo: 15 }, 200);
    await request('GET', '/perfiles', undefined, 403, 'manager');
    await request('POST', '/perfiles', { id_usuario: accounts.unassigned, rol: 'VENDEDOR', id_sucursal: 1 }, 201);
    await request('PATCH', `/perfiles/${accounts.unassigned}`, { activo: false }, 200);
    await request('GET', '/me', undefined, 403, 'unassigned');
    await request('PATCH', `/perfiles/${accounts.vendor}`, { id_usuario: accounts.admin }, 400);
  });
  await t.test('venta HTTP, idempotencia, anulación, detalles y auditoría', async function () {
    const key = crypto.randomUUID();
    const { result } = await request('POST', '/ventas', sale, 201, 'admin', { 'Idempotency-Key': key });
    const repeat = await request('POST', '/ventas', sale, 201, 'admin', { 'Idempotency-Key': key });
    assert.deepEqual(repeat.result, result);
    assert.equal(result.data.total, 20);
    await request('GET', `/ventas/${result.data.id_venta}/detalles`, undefined, 200);
    await request('POST', `/ventas/${result.data.id_venta}/anular`, { motivo: 'Corrección' }, 200);
    await request('GET', '/auditoria?tabla=ventas', undefined, 200, 'auditor');
    await request('POST', '/ventas', sale, 400, 'admin', { 'Idempotency-Key': '' });
    await request('POST', '/ventas', { ...sale, total: 0 }, 400);
    await request('POST', '/ventas', { ...sale, items: [{ id_medicamento: 1, cantidad: 1 }, { id_medicamento: 1, cantidad: 1 }] }, 400);
    await request('POST', '/ventas', { ...sale, items: [{ id_medicamento: 1, cantidad: -1 }] }, 400);
    await request('POST', '/ventas', { ...sale, id_sucursal: 2 }, 403, 'vendor');
    await request('POST', '/ventas', sale, 403, 'auditor');
  });
  await t.test('entrada/ajuste, traslado/recepción, caja/reversión y planilla', async function () {
    const { result: stock } = await request('POST', '/inventario/entradas', { id_sucursal: 1, id_medicamento: 1, lote: 'HTTP-LOTE', fecha_vencimiento: '2099-01-01', cantidad: 10, motivo: 'Compra' }, 201);
    await request('POST', `/inventario/${stock.data.id_inventario}/ajustes`, { diferencia: -1, motivo: 'Daño' }, 201);
    const { result: transfer } = await request('POST', '/traslados', { id_sucursal_origen: 1, id_sucursal_destino: 2, motivo: 'Reposición', items: [{ id_medicamento: 1, cantidad: 2 }] }, 201);
    await request('POST', `/traslados/${transfer.data.id_traslado}/recibir`, {}, 403, 'vendor');
    await request('POST', `/traslados/${transfer.data.id_traslado}/recibir`, {}, 200, 'warehouse');
    await request('GET', `/traslados/${transfer.data.id_traslado}/detalles`, undefined, 200);
    const { result: cash } = await request('POST', '/movimientos-caja', { id_sucursal: 1, tipo: 'EGRESO', concepto: 'Gasto', monto: 12.50, metodo_pago: 'EFECTIVO' }, 201);
    await request('POST', `/movimientos-caja/${cash.data.id_movimiento}/revertir`, { motivo: 'Corrección' }, 201);
    const { result: payroll } = await request('POST', '/planillas', { id_sucursal: 1, periodo: '2026-10-01' }, 201);
    await request('GET', `/planillas/${payroll.data.id_planilla}/detalles`, undefined, 200);
    await request('POST', '/planillas', { id_sucursal: 1, periodo: '2026-10-01' }, 409);
  });
  await t.test('disponibilidad y flujo completo de pedido hasta entrega', async function () {
    const { result: candidates } = await request('POST', '/disponibilidad', { latitud: order.latitud, longitud: order.longitud, items: order.items }, 200, 'callCenter');
    assert.ok(candidates.data.length);
    const { result: created } = await request('POST', '/pedidos', order, 201, 'callCenter');
    const path = `/pedidos/${created.data.id_pedido}/estado`;
    await request('GET', `/pedidos/${created.data.id_pedido}/detalles`, undefined, 200, 'callCenter');
    await request('PATCH', path, { estado: 'ENTREGADO' }, 409);
    await request('PATCH', path, { estado: 'PREPARANDO' }, 200, 'vendor');
    await request('PATCH', path, { estado: 'EN_CAMINO' }, 400);
    await request('PATCH', path, { estado: 'EN_CAMINO', repartidor: 'Luis' }, 200, 'vendor');
    await request('PATCH', path, { estado: 'ENTREGADO' }, 200, 'vendor');
    const { result: other } = await request('POST', '/pedidos', order, 201, 'callCenter');
    await request('POST', `/pedidos/${other.data.id_pedido}/reasignar`, { id_sucursal: 2, motivo: 'Cobertura' }, 200, 'callCenter');
    await request('PATCH', `/pedidos/${other.data.id_pedido}/estado`, { estado: 'CANCELADO', motivo: 'Cliente canceló' }, 200, 'callCenter');
  });
  await t.test('reportes y lectura de cada recurso respetan roles y sucursales', async function () {
    for (const path of ['sucursales', 'empleados', 'medicamentos', 'clientes', 'activos', 'stock-minimos', 'perfiles', 'inventario',
      'ventas', 'pedidos', 'traslados', 'movimientos-medicamentos', 'movimientos-caja', 'planillas', 'auditoria']) {
      await request('GET', `/${path}`, undefined, 200);
    }
    await request('GET', '/empleados', undefined, 403, 'callCenter');
    const { result } = await request('GET', '/inventario?id_sucursal=2', undefined, 200, 'vendor');
    assert.equal(result.data.length, 0);
    await request('GET', '/reportes/resumen?desde=2026-01-01T00:00:00Z&hasta=2027-01-01T00:00:00Z', undefined, 200, 'auditor');
    await request('GET', '/reportes/resumen?desde=bad&hasta=bad', undefined, 400);
    await request('GET', '/reportes/resumen?desde=2026-01-01T00:00:00Z&hasta=2027-01-01T00:00:00Z&id_sucursal=2', undefined, 403, 'manager');
  });
  await t.test('registro/login conservan formato público y errores de autenticación', async function () {
    const originalRegister = User.register;
    const originalLogin = User.login;
    const originalRefresh = User.refresh;
    const session = { access_token: 'demo', refresh_token: 'demo-refresh', expires_in: 3600, token_type: 'bearer' };
    const user = { id: accounts.admin, email: 'demo@example.com', user_metadata: { username: 'demo' } };
    try {
      User.register = async () => ({ data: { user, session: null }, error: null });
      await request('POST', '/register', { username: 'demo', email: 'demo@example.com', password: '12345678' }, 202, null);
      await request('POST', '/register', { username: 'x', email: 'bad', password: '1' }, 400, null);
      User.login = async () => ({ data: { user, session }, error: null });
      await request('POST', '/login', { email: 'demo@example.com', password: '12345678' }, 200, null);
      User.login = async () => ({ error: { code: 'invalid_credentials', status: 400 } });
      await request('POST', '/login', { email: 'demo@example.com', password: 'bad' }, 401, null);
      User.refresh = async () => ({ data: { user, session }, error: null });
      await request('POST', '/refresh', { refresh_token: 'demo-refresh' }, 200, null);
      await request('POST', '/refresh', {}, 400, null);
      User.refresh = async () => ({ error: { status: 400 } });
      await request('POST', '/refresh', { refresh_token: 'expired' }, 401, null);
    } finally { User.register = originalRegister; User.login = originalLogin; User.refresh = originalRefresh; }
  });
  await t.test('JSON mal formado y límite de tamaño tienen respuestas claras', async function () {
    const bad = await fetch(root + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(bad.status, 400);
    const large = await fetch(root + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'x'.repeat(70000) }) });
    assert.equal(large.status, 413);
  });
  await t.test('el límite de autenticación devuelve 429 y tiempo para reintentar', async function () {
    let limited = false;
    for (let i = 0; i < 25; i++) {
      const response = await fetch(root + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.ok([400, 429].includes(response.status));
      if (response.status === 429) { limited = true; assert.ok(Number(response.headers.get('retry-after')) > 0); }
      await response.text();
    }
    assert.ok(limited);
  });
});
