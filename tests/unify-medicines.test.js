import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {testDatabase} from './database-helper.js';

test('unifica productos iniciales conservando lotes, reservas, mínimos y disponibilidad',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 const ids=[];
 for(const [branch,code] of [[1,'GUA01'],[2,'MIX01']]){
  const id=(await db.query("insert into medicamentos(codigo,nombre,categoria,principio_activo,precio_compra,precio_venta) values($1,$2,'ANALGESICO','Paracetamol',5,10) returning id_medicamento",[code+'-MED-PARA500-01','Paracetamol 500 mg · '+code])).rows[0].id_medicamento;
  ids.push(id);
  await db.query("insert into inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad,reservado) values($1,$2,$3,current_date+500,5,25,3)",[branch,id,code+'-LOTE-PRUEBA']);
  await db.query('insert into stock_minimos(id_sucursal,id_medicamento,stock_minimo) values($1,$2,10)',[branch,id]);
 }
 const sql=await readFile(new URL('../database/026_unify_initial_medicines.sql',import.meta.url),'utf8');
 await db.query('update medicamentos set descuento_porcentaje=10 where id_medicamento=$1',[ids[1]]);
 await db.exec(sql);
 const products=(await db.query("select * from medicamentos where codigo='MED-PARA500-01'")).rows;
 assert.equal(products.length,1);assert.equal(products[0].nombre,'Paracetamol 500 mg');
 assert.equal(Number(products[0].descuento_porcentaje),10);
 const lots=(await db.query('select * from inventario where id_medicamento=$1 order by id_sucursal',[ids[0]])).rows;
 assert.equal(lots.length,2);assert.ok(lots.every(row=>row.cantidad===25&&row.reservado===3));
 assert.equal((await db.query('select count(*)::int n from stock_minimos where id_medicamento=$1',[ids[0]])).rows[0].n,2);
 const catalog=(await db.query("select catalogo_publico(p_busqueda=>'Paracetamol') data")).rows[0].data;
 const product=catalog.data.find(row=>row.id_medicamento===ids[0]);
 assert.equal(product.sucursales.length,2);
 await db.exec(sql);
 assert.equal((await db.query('select count(*)::int n from inventario where id_medicamento=$1',[ids[0]])).rows[0].n,2);
});
