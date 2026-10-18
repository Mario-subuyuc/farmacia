import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './database-helper.js';

test('12 productos DEMO, stock por sucursal, agotados y seeder que conserva operaciones', async t => {
  const db = await testDatabase(); t.after(() => db.close());
  const products = await db.query("select count(*)::int total from medicamentos where codigo like 'DEMO-%'");
  assert.equal(products.rows[0].total, 12);
  const rows = (await db.query(`select s.codigo,s.nombre,i.cantidad from inventario i
    join sucursales s using(id_sucursal) join medicamentos m using(id_medicamento)
    where m.codigo='DEMO-IBU' order by s.codigo`)).rows;
  assert.deepEqual(rows.map(row => row.cantidad), [80,25,0]);
  assert.equal((await db.query("select count(*)::int total from inventario where cantidad=0")).rows[0].total, 10);
  const noStock = (await db.query("select catalogo_publico('hidrocortisona') as data")).rows[0].data;
  assert.equal(noStock.data[0].sucursales.length, 0);
  const lot = (await db.query(`select i.id_inventario from inventario i join medicamentos m using(id_medicamento)
    join sucursales s using(id_sucursal) where m.codigo='DEMO-IBU' and s.codigo='DEMO-GUA'`)).rows[0];
  await db.query('update inventario set cantidad=70 where id_inventario=$1', [lot.id_inventario]);
  const before = (await db.query('select count(*)::int total from movimientos_medicamentos')).rows[0].total;
  await db.exec(await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query('select cantidad from inventario where id_inventario=$1', [lot.id_inventario])).rows[0].cantidad, 70);
  assert.equal((await db.query('select count(*)::int total from movimientos_medicamentos')).rows[0].total, before);
  assert.equal((await db.query('select count(*)::int total from inventario')).rows[0].total, 37);
});
