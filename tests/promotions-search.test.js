import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, asUser, operation } from './database-helper.js';
import { normalizeProductQuery } from '../src/services/product-search.js';
test('búsqueda guiada normaliza tildes, mayúsculas y preguntas; rechaza símbolos',()=>{
 assert.equal(normalizeProductQuery('¿QUÉ PRECIO tiene PARACETAMÓL 500?'),'paracetamol 500');
 assert.equal(normalizeProductQuery('Hola, quiero información'),'');
 assert.equal(normalizeProductQuery('PARACETAMO\u0301L'),'paracetamol');
 assert.throws(()=>normalizeProductQuery("'; DROP TABLE medicamentos;--"),{status:400});
 assert.throws(()=>normalizeProductQuery('a'.repeat(101)),{status:400});
});
test('promociones: catálogo, venta y portal coinciden; fechas y permisos se respetan',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 // La vigencia usa el día de Guatemala, igual que precio_catalogo(), no el de la sesión SQL.
 await asUser(db,'admin',()=>db.query("update medicamentos set descuento_porcentaje=15,promocion_titulo='Especial',promocion_desde=(now() at time zone 'America/Guatemala')::date-1,promocion_hasta=(now() at time zone 'America/Guatemala')::date+1 where id_medicamento=1"));
 await db.exec('set role anon');
 const catalog=(await db.query("select catalogo_publico('PARACETAMÓL 500',null,null,1,12) data")).rows[0].data;
 await db.exec('reset role');
 assert.equal(catalog.pagination.total,1);assert.equal(catalog.data[0].precio_venta,8.5);assert.equal(catalog.data[0].precio_regular,10);assert.equal(catalog.promociones.length,1);
 const sale=await asUser(db,'admin',()=>operation(db,'venta',{id_sucursal:1,metodo_pago:'EFECTIVO',items:[{id_medicamento:1,cantidad:2}]}));assert.equal(sale.total,17);
 const details=(await db.query('select precio_unitario from detalle_venta where id_venta=$1',[sale.id_venta])).rows;assert.ok(details.every(d=>Number(d.precio_unitario)===8.5));
 const data={nombre:'A',apellido:'B',telefono:'55550101',direccion_entrega:'Zona 1',latitud:14.6407,longitud:-90.5133,id_sucursal:1,metodo_pago:'TARJETA',items:[{id_medicamento:1,cantidad:1}]};
 const portal=(await db.query('select crear_pedido_portal($1,$2,$3) data',[JSON.stringify(data),crypto.randomUUID(),'a'.repeat(64)])).rows[0].data;assert.equal(portal.total,8.5);
 assert.equal(Number((await db.query('select precio_unitario from detalle_pedido where id_pedido=$1',[portal.id_pedido])).rows[0].precio_unitario),8.5);
 await db.query("update medicamentos set promocion_desde=(now() at time zone 'America/Guatemala')::date-2,promocion_hasta=(now() at time zone 'America/Guatemala')::date-1 where id_medicamento=1");
 assert.equal(Number((await db.query('select precio_catalogo(m) precio from medicamentos m where id_medicamento=1')).rows[0].precio),10);
 await db.query("update medicamentos set promocion_desde=(now() at time zone 'America/Guatemala')::date+1,promocion_hasta=(now() at time zone 'America/Guatemala')::date+2 where id_medicamento=1");
 assert.equal(Number((await db.query('select precio_catalogo(m) precio from medicamentos m where id_medicamento=1')).rows[0].precio),10);
 await assert.rejects(db.query('update medicamentos set descuento_porcentaje=100 where id_medicamento=1'),/check constraint/);
 await asUser(db,'vendor',()=>db.query('update medicamentos set descuento_porcentaje=20 where id_medicamento=1'));
 assert.equal(Number((await db.query('select descuento_porcentaje from medicamentos where id_medicamento=1')).rows[0].descuento_porcentaje),15);
});
