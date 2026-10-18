import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './database-helper.js';

test('catálogo PostgreSQL público: permisos y disponibilidad real', async t => {
  const db = await testDatabase(); t.after(() => db.close());
  async function catalog(search = '', branch = null, category = null, page = 1, limit = 12) {
    await db.exec('set role anon');
    try { return (await db.query('select catalogo_publico($1,$2,$3,$4,$5) as data', [search,branch,category,page,limit])).rows[0].data; }
    finally { await db.exec('reset role'); }
  }
  await t.test('anónimo ve productos y contactos, pero no costos ni lotes', async () => {
    const data = await catalog();
    assert.equal(data.pagination.total, 12);
    assert.equal(data.sucursales.length, 3);
    for (const product of data.data) {
      assert.deepEqual(Object.keys(product).sort(), ['id_medicamento','nombre','descripcion','categoria','principio_activo','precio_venta','requiere_receta','imagen_url','precio_regular','descuento_aplicado','promocion_titulo','promocion_hasta','sucursales'].sort());
      assert.ok(product.sucursales.length <= 3);
      if (product.sucursales.length) assert.equal(product.sucursales[0].lote, undefined);
    }
    await db.exec('set role anon');
    try {
      await assert.rejects(db.query('select * from inventario'), /permission denied/);
      await assert.rejects(db.query('select * from empleados'), /permission denied/);
      await assert.rejects(db.query("select ejecutar_operacion('caja','{}'::jsonb,gen_random_uuid())"), /permission denied/);
    } finally { await db.exec('reset role'); }
  });
  await t.test('filtros, paginación y búsqueda literal', async () => {
    const data = await catalog('para', 1, 'ANALGESICO');
    assert.equal(data.pagination.total, 1);
    assert.equal(data.data[0].sucursales.length, 1);
    assert.equal((await catalog('', null, null, 2, 2)).data.length, 2);
    assert.equal((await catalog("' OR 1=1 --")).pagination.total, 0);
    await assert.rejects(catalog('', null, null, 0), /inválidos/);
  });
  await t.test('ignora vencidos y reservas, y no suma lotes dos veces como sucursales', async () => {
    await db.query("update inventario set reservado=cantidad where id_sucursal=1 and id_medicamento=1");
    assert.equal((await catalog('Paracetamol', 1)).pagination.total, 0);
    await db.query("update inventario set reservado=0,fecha_vencimiento=current_date-1 where id_sucursal=1 and id_medicamento=1");
    assert.equal((await catalog('Paracetamol', 1)).pagination.total, 0);
    const data = await catalog('Paracetamol');
    assert.equal(data.data[0].sucursales.length, 2);
  });
  await t.test('oculta sucursales y medicamentos inactivos', async () => {
    await db.query("update sucursales set estado='INACTIVA' where id_sucursal=2");
    assert.equal((await catalog()).sucursales.length, 2);
    assert.equal((await catalog('', 2)).pagination.total, 0);
    await db.query("update medicamentos set estado='INACTIVO' where id_medicamento=2");
    assert.equal((await catalog('Amoxicilina')).pagination.total, 0);
  });
});
