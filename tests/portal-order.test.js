import './setup-env.js';
﻿import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { testDatabase, asUser, operation } from './database-helper.js';
import { validateCheckout } from '../src/controllers/portal-order.controller.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
test('portal: pedido atómico, reintento, stock, seguimiento privado y despacho', async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 const data={nombre:'Cliente',apellido:'Prueba',telefono:'55550101',direccion_entrega:'Zona 1, Guatemala',id_sucursal:1,latitud:14.6407,longitud:-90.5133,metodo_pago:'EFECTIVO',items:[{id_medicamento:1,cantidad:2}]};
 const key=randomUUID(), token=hash(randomUUID());
 async function create(body=data,clave=key,code=token){return (await db.query('select crear_pedido_portal($1::jsonb,$2::uuid,$3) as data',[JSON.stringify(body),clave,hash(code)])).rows[0].data;}
 const result=await create();assert.equal(result.estado,'PENDIENTE');assert.equal(result.total,20);
 assert.deepEqual(await create(),result);
 await assert.rejects(create({...data,items:[{id_medicamento:1,cantidad:3}]}),/otro pedido/);
 const reserved=await db.query('select sum(reservado)::int n from inventario where id_sucursal=1 and id_medicamento=1');assert.equal(reserved.rows[0].n,2);
 let tracking=(await db.query('select seguir_pedido_portal($1) data',[hash(token)])).rows[0].data;
 assert.equal(tracking.id_pedido,result.id_pedido);assert.equal(tracking.telefono,undefined);assert.equal(tracking.direccion_entrega,undefined);
 assert.equal((await db.query("select seguir_pedido_portal('incorrecto') data")).rows[0].data,null);
 await asUser(db,'admin',()=>operation(db,'estado_pedido',{id_pedido:result.id_pedido,estado:'PREPARANDO'}));
 tracking=(await db.query('select seguir_pedido_portal($1) data',[hash(token)])).rows[0].data;assert.equal(tracking.estado,'PREPARANDO');
 const count=(await db.query('select count(*)::int n from clientes')).rows[0].n;
 await assert.rejects(create({...data,items:[{id_medicamento:1,cantidad:9999}]},randomUUID(),hash('other')),/Stock/i);
 assert.equal((await db.query('select count(*)::int n from clientes')).rows[0].n,count);
 await assert.rejects(create({...data,items:[{id_medicamento:2,cantidad:1}]},randomUUID(),hash('rx')),/receta/);
 await assert.rejects(create({...data,latitud:0,longitud:0},randomUUID(),hash('far')),/radio/);
 await db.exec('set role anon');
 try{await assert.rejects(create(),/permission denied/);await assert.rejects(db.query('select seguir_pedido_portal($1)',[hash(token)]),/permission denied/);}finally{await db.exec('reset role');}
});
test('checkout rechaza precios, cantidades excesivas y códigos inválidos',()=>{
 const data={nombre:'A',apellido:'B',telefono:'55550101',direccion_entrega:'Zona 1',id_sucursal:1,latitud:14,longitud:-90,metodo_pago:'TARJETA',items:[{id_medicamento:1,cantidad:1}],clave:randomUUID(),token:hash('test')};
 assert.equal(validateCheckout(data).metodo_pago,'TARJETA');
 assert.throws(()=>validateCheckout({...data,total:1}),{status:400});
 assert.throws(()=>validateCheckout({...data,items:[{id_medicamento:1,cantidad:100}]}),{status:400});
 assert.throws(()=>validateCheckout({...data,token:'fake'}),{status:400});
});
