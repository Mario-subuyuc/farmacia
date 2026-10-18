import test from 'node:test';
import assert from 'node:assert/strict';
import { initialValues, formPayload, parseItems, operationKey } from '../src/utils/forms.js';
import { reportDates } from '../src/utils/format.js';
import { csvText } from '../src/utils/csv.js';
import { recordActions, newOperation } from '../src/config/operations.js';

test('inputs convierten números/booleanos, preservan cero y omiten campos vacíos', function () {
  const fields = [{ name: 'id_sucursal', type: 'select', numeric: true }, { name: 'monto', type: 'number' },
    { name: 'activo', type: 'checkbox' }, { name: 'email', nullable: true }, { name: 'periodo', type: 'month' }];
  assert.deepEqual(formPayload(fields, { id_sucursal: '2', monto: '0', activo: false, email: '', periodo: '2026-10' }),
    { id_sucursal: 2, monto: 0, activo: false, periodo: '2026-10-01' });
  assert.equal(formPayload(fields, { email: '' }, true).email, null);
  assert.deepEqual(initialValues([{ name: 'activo', type: 'checkbox', defaultValue: true }], { activo: false }), { activo: false });
});
test('líneas rechazan medicamentos repetidos, cantidades negativas/fraccionarias y selección vacía', function () {
  assert.deepEqual(parseItems([{ id_medicamento: '1', cantidad: '2' }]), [{ id_medicamento: 1, cantidad: 2 }]);
  for (const quantity of [0, -1, 1.2, '']) assert.throws(() => parseItems([{ id_medicamento: 1, cantidad: quantity }]));
  assert.throws(() => parseItems([{ id_medicamento: 1, cantidad: 1 }, { id_medicamento: 1, cantidad: 2 }]), /No repitas/);
  assert.throws(() => parseItems([]));
});
test('idempotencia reutiliza clave con el mismo cuerpo y cambia al editar la operación', function () {
  let count = 0; const uuid = () => `clave-${++count}`;
  const first = operationKey(null, '/ventas', { items: [1] }, uuid);
  assert.equal(operationKey(first, '/ventas', { items: [1] }, uuid), first);
  assert.notEqual(operationKey(first, '/ventas', { items: [2] }, uuid).key, first.key);
  assert.notEqual(operationKey(first, '/pedidos', { items: [1] }, uuid).key, first.key);
});
test('rango incluye el último día con horario de Guatemala, incluso cambio de año', function () {
  assert.deepEqual(reportDates('2026-12-01', '2026-12-31'), { desde: '2026-12-01T00:00:00-06:00', hasta: '2027-01-01T00:00:00-06:00' });
});
test('acciones por rol/sucursal: auditor no escribe y bodega solo recibe en destino', function () {
  assert.equal(newOperation('ventas', { rol: 'AUDITOR' }), null);
  assert.equal(recordActions('traslados', { id_traslado: 1, id_sucursal_origen: 1, id_sucursal_destino: 2, estado: 'EN_TRANSITO' }, { rol: 'BODEGA', id_sucursal: 1 }).length, 0);
  assert.equal(recordActions('traslados', { id_traslado: 1, id_sucursal_origen: 1, id_sucursal_destino: 2, estado: 'EN_TRANSITO' }, { rol: 'BODEGA', id_sucursal: 2 }).length, 1);
  assert.equal(recordActions('pedidos', { id_pedido: 1, id_sucursal: 1, estado: 'EN_CAMINO' }, { rol: 'CALL_CENTER' }).length, 0);
});
test('CSV escapa comillas, saltos de línea y fórmulas', function () {
  const csv = csvText([{ nombre: '=1+1', nota: 'Dijo "sí"\nPrueba' }], ['nombre', 'nota']);
  assert.ok(csv.includes("'=1+1")); assert.ok(csv.includes('Dijo ""sí""'));
});
