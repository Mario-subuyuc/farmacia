import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { testDatabase, asUser, operation, accounts } from './database-helper.js';

test('PostgreSQL: transacciones, stock, permisos, auditoría y reportes', async function (t) {
  const db = await testDatabase();
  t.after(() => db.close());
  async function admin(action, data, key) { return asUser(db, 'admin', () => operation(db, action, data, key)); }
  const sale = { id_sucursal: 1, id_cliente: 1, id_empleado: 1, metodo_pago: 'EFECTIVO', items: [{ id_medicamento: 1, cantidad: 3 }] };
  const order = { id_sucursal: 1, id_cliente: 1, latitud: 14.6407, longitud: -90.5133, direccion_entrega: 'Dirección demo',
    metodo_pago: 'TARJETA', canal: 'TELEFONO', items: [{ id_medicamento: 1, cantidad: 4 }] };
  let saleId; let orderId; let transferId;

  await t.test('el seeder puede repetirse sin duplicar stock ni caja', async function () {
    const before = (await db.query('select sum(cantidad) cantidad from inventario')).rows[0];
    await db.exec(await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query('select sum(cantidad) cantidad from inventario')).rows[0], before);
    assert.equal((await db.query("select count(*) from movimientos_caja where concepto='Apertura DEMO'")).rows[0].count, 3);
  });
  await t.test('venta FEFO calcula total y genera caja sin aceptar total del cliente', async function () {
    const result = await admin('venta', sale);
    saleId = result.id_venta;
    assert.equal(result.total, 30);
    assert.equal((await db.query('select cantidad from inventario where id_inventario=1')).rows[0].cantidad, 97);
    assert.equal((await db.query('select monto from movimientos_caja where id_venta=$1', [saleId])).rows[0].monto, '30.00');
  });
  await t.test('reintentar una operación no duplica la venta y rechaza cambiar datos', async function () {
    const key = crypto.randomUUID();
    const first = await admin('venta', sale, key);
    assert.deepEqual(await admin('venta', sale, key), first);
    await assert.rejects(admin('venta', { ...sale, metodo_pago: 'TARJETA' }, key), /Clave ya usada/);
  });
  await t.test('stock insuficiente revierte cabecera, detalles, caja y cambios de lotes', async function () {
    const before = (await db.query('select sum(cantidad) cantidad from inventario')).rows[0];
    const count = (await db.query('select count(*) from ventas')).rows[0].count;
    await assert.rejects(admin('venta', { ...sale, items: [{ id_medicamento: 1, cantidad: 5 }, { id_medicamento: 2, cantidad: 99999 }], receta_referencia: 'RX-demo' }), /Stock/);
    assert.deepEqual((await db.query('select sum(cantidad) cantidad from inventario')).rows[0], before);
    assert.equal((await db.query('select count(*) from ventas')).rows[0].count, count);
  });
  await t.test('receta obligatoria y empleado de la misma sucursal', async function () {
    await assert.rejects(admin('venta', { ...sale, items: [{ id_medicamento: 2, cantidad: 1 }] }), /receta/);
    await assert.rejects(admin('venta', { ...sale, id_empleado: 2 }), /Empleado/);
  });
  await t.test('anular devuelve stock y revierte el ingreso una sola vez', async function () {
    const result = await admin('anular_venta', { id_venta: saleId, motivo: 'Error de captura' });
    assert.equal(result.estado, 'ANULADA');
    assert.equal((await db.query('select sum(case when tipo=\'INGRESO\' then monto else -monto end) saldo from movimientos_caja where id_venta=$1', [saleId])).rows[0].saldo, '0.00');
    await assert.rejects(admin('anular_venta', { id_venta: saleId, motivo: 'Otra vez' }), /Solo se anulan/);
  });
  await t.test('consultar disponibilidad filtra distancia y muestra receta/precio/ETA', async function () {
    const result = await asUser(db, 'callCenter', async () => db.query('select consultar_disponibilidad($1::jsonb) data', [JSON.stringify({ latitud: 14.6407, longitud: -90.5133, items: [{ id_medicamento: 1, cantidad: 1 }] })]));
    const candidates = result.rows[0].data;
    assert.ok(candidates.length >= 1);
    assert.equal(candidates[0].id_sucursal, 1);
    assert.equal(candidates[0].tiempo_estimado_minutos, 15);
    assert.ok(!candidates.some(c => c.id_sucursal === 3));
  });
  await t.test('pedido reserva stock; ventas y ajustes no pueden consumir reservas', async function () {
    const result = await asUser(db, 'callCenter', () => operation(db, 'pedido', order));
    orderId = result.id_pedido;
    assert.equal((await db.query('select sum(reservado) total from inventario where id_sucursal=1')).rows[0].total, 4);
    const lot = (await db.query('select * from inventario where id_inventario=1')).rows[0];
    await assert.rejects(admin('ajuste', { id_inventario: 1, diferencia: -lot.cantidad, motivo: 'Conteo' }), /reservado/);
    await assert.rejects(admin('venta', { ...sale, items: [{ id_medicamento: 1, cantidad: 148 }] }), /Stock/);
  });
  await t.test('flujo de entrega crea venta/caja una vez y conserva precio reservado', async function () {
    await assert.rejects(admin('estado_pedido', { id_pedido: orderId, estado: 'ENTREGADO' }), /estado/);
    await admin('estado_pedido', { id_pedido: orderId, estado: 'PREPARANDO' });
    await admin('estado_pedido', { id_pedido: orderId, estado: 'EN_CAMINO', repartidor: 'Luis Demo' });
    await db.exec('update medicamentos set precio_venta=12 where id_medicamento=1');
    const result = await admin('estado_pedido', { id_pedido: orderId, estado: 'ENTREGADO' });
    assert.ok(result.id_venta);
    assert.equal((await db.query('select total from ventas where id_venta=$1', [result.id_venta])).rows[0].total, '40.00');
    assert.equal((await db.query('select sum(reservado) total from inventario where id_sucursal=1')).rows[0].total, 0);
    await assert.rejects(admin('estado_pedido', { id_pedido: orderId, estado: 'ENTREGADO' }), /estado/);
  });
  await t.test('cancelación libera reservas y no registra ingreso', async function () {
    const result = await admin('pedido', order);
    await admin('estado_pedido', { id_pedido: result.id_pedido, estado: 'CANCELADO' });
    assert.equal((await db.query('select sum(reservado) total from inventario')).rows[0].total, 0);
    assert.equal((await db.query('select count(*) from ventas where id_pedido=$1', [result.id_pedido])).rows[0].count, 0);
  });
  await t.test('traslado sale de origen y solo entra al confirmar recepción en destino', async function () {
    const before = (await db.query('select cantidad from inventario where id_inventario=4')).rows[0].cantidad;
    const result = await admin('traslado', { id_sucursal_origen: 1, id_sucursal_destino: 2, motivo: 'Reposición', items: [{ id_medicamento: 1, cantidad: 6 }] });
    transferId = result.id_traslado;
    assert.equal((await db.query('select cantidad from inventario where id_inventario=4')).rows[0].cantidad, before);
    await asUser(db, 'warehouse', () => operation(db, 'recibir_traslado', { id_traslado: transferId }));
    assert.equal((await db.query('select cantidad from inventario where id_inventario=4')).rows[0].cantidad, before + 6);
    await assert.rejects(admin('recibir_traslado', { id_traslado: transferId }), /ya fue recibido/);
  });
  await t.test('planilla guarda salarios/ajustes y egreso; no duplica el mes', async function () {
    const result = await admin('planilla', { id_sucursal: 1, periodo: '2026-10-01', ajustes: [{ id_empleado: 1, bonificacion: 250, deduccion: 100 }] });
    assert.equal(result.total, 4150);
    assert.equal((await db.query('select monto from movimientos_caja where id_planilla=$1', [result.id_planilla])).rows[0].monto, '4150.00');
    await assert.rejects(admin('planilla', { id_sucursal: 1, periodo: '2026-10-01' }), /unique constraint/);
    await assert.rejects(admin('planilla', { id_sucursal: 1, periodo: '2026-11-01', ajustes: [{ id_empleado: 2, bonificacion: 1 }] }), /ajeno/);
  });
  await t.test('entrada y ajuste generan historial; lote no cambia fecha de vencimiento', async function () {
    const result = await admin('entrada', { id_sucursal: 1, id_medicamento: 3, lote: 'TEST-ENTRADA', fecha_vencimiento: '2099-01-01', cantidad: 10, motivo: 'Compra' });
    await admin('ajuste', { id_inventario: result.id_inventario, diferencia: -2, motivo: 'Daño' });
    assert.equal((await db.query('select cantidad from inventario where id_inventario=$1', [result.id_inventario])).rows[0].cantidad, 8);
    await assert.rejects(admin('entrada', { id_sucursal: 1, id_medicamento: 3, lote: 'TEST-ENTRADA', fecha_vencimiento: '2098-01-01', cantidad: 1, motivo: 'Compra' }), /otra fecha/);
    await assert.rejects(admin('entrada', { id_sucursal: 1, id_medicamento: 3, lote: 'OLD', fecha_vencimiento: '2000-01-01', cantidad: 1, motivo: 'Compra' }), /vencimiento/);
  });
  await t.test('caja manual se revierte con contrapartida, nunca borrando movimientos', async function () {
    const result = await admin('caja', { id_sucursal: 1, tipo: 'EGRESO', concepto: 'Gasto demo', monto: 20, metodo_pago: 'EFECTIVO' });
    await admin('revertir_caja', { id_movimiento: result.id_movimiento, motivo: 'Corrección' });
    await assert.rejects(admin('revertir_caja', { id_movimiento: result.id_movimiento, motivo: 'Otra vez' }), /unique constraint/);
  });
  await t.test('RLS gerente solo ve su sucursal y no modifica otra', async function () {
    await asUser(db, 'manager', async function () {
      assert.equal((await db.query('select count(*) from empleados')).rows[0].count, 1);
      assert.equal((await db.query('select count(*) from ventas where id_sucursal=2')).rows[0].count, 0);
      assert.equal((await db.query('update empleados set salario=1 where id_sucursal=2 returning *')).rows.length, 0);
      assert.equal((await db.query("select count(*) from auditoria where id_sucursal=2 or id_sucursal is null")).rows[0].count, 0);
      await assert.rejects(operation(db, 'venta', { ...sale, id_sucursal: 2 }), /permiso/);
      assert.equal((await db.query("update medicamentos set precio_venta=1 where id_medicamento=1 returning *")).rows.length, 0);
    });
  });
  await t.test('nadie escribe directamente stock, caja, auditoría ni helpers privados', async function () {
    await asUser(db, 'admin', async function () {
      await assert.rejects(db.exec('update inventario set cantidad=9999'), /permission/);
      await assert.rejects(db.exec('delete from auditoria'), /permission/);
      await assert.rejects(db.query('select privado.entrada($1::jsonb)', ['{}']), /permission/);
    });
    await asUser(db, 'unassigned', async function () {
      assert.equal((await db.query('select count(*) from medicamentos')).rows[0].count, 0);
      await assert.rejects(operation(db, 'venta', sale), /permisos/);
    });
    await asUser(db, 'auditor', async function () {
      await assert.rejects(operation(db, 'venta', sale), /permisos/);
      assert.ok((await db.query('select count(*) from auditoria')).rows[0].count > 0);
    });
  });
  await t.test('call center no ve salarios, caja ni modifica la entrega final', async function () {
    await asUser(db, 'callCenter', async function () {
      assert.equal((await db.query('select count(*) from empleados')).rows[0].count, 0);
      assert.equal((await db.query('select count(*) from movimientos_caja')).rows[0].count, 0);
      const result = await operation(db, 'pedido', order);
      await assert.rejects(operation(db, 'estado_pedido', { id_pedido: result.id_pedido, estado: 'PREPARANDO' }), /permiso/);
      await operation(db, 'estado_pedido', { id_pedido: result.id_pedido, estado: 'CANCELADO' });
    });
  });
  await t.test('reporte agrega caja por medio de pago, planilla, activos y stock respetando RLS', async function () {
    const result = await asUser(db, 'manager', () => db.query("select reporte_empresa('2000-01-01','2100-01-01',null) data"));
    const report = result.rows[0].data;
    assert.equal(report.planilla_pagada, 4150);
    assert.ok(report.caja.every(c => c.id_sucursal === 1));
    assert.ok(report.activos.every(c => c.id_sucursal === 1));
    assert.ok(report.stock.every(c => c.id_sucursal === 1));
    assert.ok(report.activos[0].valor_contable_estimado >= 600);
  });
  await t.test('auditoría registra actor, cambios y sucursal de detalles', async function () {
    const records = await db.query("select * from auditoria where tabla='detalle_venta'");
    assert.ok(records.rows.length > 0);
    assert.ok(records.rows.every(r => r.id_sucursal === 1 && r.actor === accounts.admin));
    assert.ok(records.rows[0].despues.id_venta);
  });
  await t.test('reasignación conserva precios y cambia reservas; falla sin perder reserva original', async function () {
    const result = await admin('pedido', order);
    const original = (await db.query('select total from pedidos where id_pedido=$1', [result.id_pedido])).rows[0].total;
    await assert.rejects(admin('reasignar_pedido', { id_pedido: result.id_pedido, id_sucursal: 3, motivo: 'Lejos' }), /radio/);
    assert.equal((await db.query('select id_sucursal from pedidos where id_pedido=$1', [result.id_pedido])).rows[0].id_sucursal, 1);
    const destinationStock = (await db.query('select cantidad from inventario where id_inventario=4')).rows[0].cantidad;
    await admin('ajuste', { id_inventario: 4, diferencia: 2-destinationStock, motivo: 'Simular falta de stock' });
    await assert.rejects(admin('reasignar_pedido', { id_pedido: result.id_pedido, id_sucursal: 2, motivo: 'Sin stock' }), /Stock/);
    assert.equal((await db.query('select sum(reservado) total from inventario where id_sucursal=1')).rows[0].total, 4);
    await admin('ajuste', { id_inventario: 4, diferencia: destinationStock-2, motivo: 'Restablecer conteo' });
    await asUser(db, 'callCenter', () => operation(db, 'reasignar_pedido', { id_pedido: result.id_pedido, id_sucursal: 2, motivo: 'Mejor cobertura' }));
    assert.equal((await db.query('select total from pedidos where id_pedido=$1', [result.id_pedido])).rows[0].total, original);
    assert.equal((await db.query('select sum(reservado) total from inventario where id_sucursal=1')).rows[0].total, 0);
    assert.equal((await db.query('select sum(reservado) total from inventario where id_sucursal=2')).rows[0].total, 4);
    await admin('estado_pedido', { id_pedido: result.id_pedido, estado: 'CANCELADO' });
  });
  await t.test('devolución de pedido no entregado libera stock y no genera cobro', async function () {
    const result = await admin('pedido', order);
    await admin('estado_pedido', { id_pedido: result.id_pedido, estado: 'PREPARANDO' });
    await admin('estado_pedido', { id_pedido: result.id_pedido, estado: 'EN_CAMINO', repartidor: 'Luis' });
    await admin('estado_pedido', { id_pedido: result.id_pedido, estado: 'DEVUELTO', motivo: 'Cliente ausente, productos recibidos en sucursal' });
    assert.equal((await db.query('select sum(reservado) total from inventario')).rows[0].total, 0);
    assert.equal((await db.query('select count(*) from ventas where id_pedido=$1', [result.id_pedido])).rows[0].count, 0);
  });
  await t.test('FEFO reparte entre lotes, ignora vencidos y conserva costo histórico', async function () {
    const med = (await db.query(`insert into medicamentos(codigo,nombre,categoria,principio_activo,precio_compra,precio_venta)
      values('TEST-FEFO','Prueba FEFO','PRUEBA','Prueba',2,5) returning id_medicamento`)).rows[0].id_medicamento;
    await db.query(`insert into inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad) values
      (1,$1,'VENCIDO',current_date-1,2,50), (1,$1,'PRIMERO',current_date+10,2,2), (1,$1,'SEGUNDO',current_date+20,3,3)`, [med]);
    const result = await admin('venta', { ...sale, items: [{ id_medicamento: med, cantidad: 4 }] });
    const lines = (await db.query('select d.cantidad,i.lote,i.costo_unitario from detalle_venta d join inventario i using(id_inventario) where id_venta=$1 order by i.fecha_vencimiento', [result.id_venta])).rows;
    assert.deepEqual(lines.map(l => [l.lote, l.cantidad]), [['PRIMERO', 2], ['SEGUNDO', 2]]);
    await assert.rejects(admin('venta', { ...sale, items: [{ id_medicamento: med, cantidad: 2 }] }), /Stock/);
    await db.query('update medicamentos set precio_compra=100 where id_medicamento=$1', [med]);
    assert.equal(lines[1].costo_unitario, '3.00');
    const pedido = await admin('pedido', { ...order, items: [{ id_medicamento: med, cantidad: 1 }] });
    await admin('estado_pedido', { id_pedido: pedido.id_pedido, estado: 'PREPARANDO' });
    await admin('estado_pedido', { id_pedido: pedido.id_pedido, estado: 'EN_CAMINO', repartidor: 'Luis' });
    await db.query("update inventario set fecha_vencimiento=current_date where lote='SEGUNDO' and id_medicamento=$1", [med]);
    await assert.rejects(admin('estado_pedido', { id_pedido: pedido.id_pedido, estado: 'ENTREGADO' }), /vencido/);
    await admin('estado_pedido', { id_pedido: pedido.id_pedido, estado: 'DEVUELTO', motivo: 'Lote vencido, retorno a sucursal' });
  });
  await t.test('anónimo no ejecuta RPC y un perfil desactivado pierde los permisos', async function () {
    await db.exec('set role anon');
    try {
      await assert.rejects(operation(db, 'venta', sale), /permission/);
      await assert.rejects(db.exec('select * from inventario'), /permission/);
    } finally { await db.exec('reset role'); }
    await db.query('update perfiles set activo=false where id_usuario=$1', [accounts.vendor]);
    await asUser(db, 'vendor', async function () {
      assert.equal((await db.query('select count(*) from inventario')).rows[0].count, 0);
      await assert.rejects(operation(db, 'venta', sale), /permisos/);
    });
  });
  await t.test('cambiar el rol también impide leer un resultado idempotente privilegiado', async function () {
    const key = crypto.randomUUID();
    const payment = { id_sucursal: 1, periodo: '2026-12-01' };
    await asUser(db, 'manager', () => operation(db, 'planilla', payment, key));
    await db.query("update perfiles set rol='VENDEDOR' where id_usuario=$1", [accounts.manager]);
    await asUser(db, 'manager', () => assert.rejects(operation(db, 'planilla', payment, key), /permiso/));
  });
  await t.test('alerta de mínimo también incluye medicamentos sin ningún lote', async function () {
    const med = (await db.query(`insert into medicamentos(codigo,nombre,categoria,principio_activo,precio_compra,precio_venta)
      values('TEST-SIN-STOCK','Sin existencias','PRUEBA','Prueba',2,5) returning id_medicamento`)).rows[0].id_medicamento;
    await db.query('insert into stock_minimos(id_sucursal,id_medicamento,stock_minimo) values(1,$1,10)', [med]);
    const result = await asUser(db, 'auditor', () => db.query("select reporte_empresa('2000-01-01','2100-01-01',null) data"));
    const row = result.rows[0].data.stock.find(s => s.id_medicamento === med && s.id_sucursal === 1);
    assert.equal(row.disponible, 0);
    assert.equal(row.valor_compra, 0);
    assert.equal(row.bajo_minimo, true);
  });
});
