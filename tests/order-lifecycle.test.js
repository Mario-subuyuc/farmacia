import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, asUser, operation } from './database-helper.js';
const hash='b'.repeat(64);
const data={nombre:'Cliente',apellido:'Prueba',telefono:'55550101',email:'test@example.invalid',direccion_entrega:'Zona 1',id_sucursal:1,latitud:14.6407,longitud:-90.5133,metodo_pago:'EFECTIVO',items:[{id_medicamento:1,cantidad:2}]};
async function create(db,body=data,token=hash){return (await db.query('select crear_pedido_portal($1,$2,$3) data',[JSON.stringify(body),crypto.randomUUID(),token])).rows[0].data;}
async function manage(db,id,action,body){return asUser(db,'admin',()=>db.query('select gestionar_pedido_portal($1,$2,$3)',[id,action,JSON.stringify(body)]));}
async function state(db,id,estado,extra={}){return asUser(db,'admin',()=>operation(db,'estado_pedido',{id_pedido:id,estado,...extra}));}
test('cotización y cupón coinciden; se exige aceptar el total actual y se limita el uso',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 await db.query('update sucursales set costo_envio=5 where id_sucursal=1');
 await db.query("insert into cupones(codigo,porcentaje,max_usos) values('BIENVENIDO',10,1)");
 const body={...data,cupon:'BIENVENIDO'};
 const quote=(await db.query('select cotizar_pedido_portal($1) data',[JSON.stringify(body)])).rows[0].data;
 assert.deepEqual(quote,{subtotal:20,costo_envio:5,descuento_cupon:2,total:23});
 await assert.rejects(create(db,{...body,total_aceptado:1}),/total cambió/);
 assert.equal((await db.query('select usos from cupones')).rows[0].usos,0);
 const order=await create(db,{...body,total_aceptado:23});assert.equal(order.total,23);
 await assert.rejects(create(db,body,'c'.repeat(64)),/Cupón/);
 assert.equal((await db.query('select count(*)::int n from pedidos')).rows[0].n,1);
 await db.query("update sucursales set dias_entrega=case when extract(isodow from now() at time zone 'America/Guatemala')=1 then '2' else '1' end where id_sucursal=1");
 await assert.rejects(create(db,data,'d'.repeat(64)),/horario/);
});
test('recetas privadas: bloqueo de preparación, permisos y cobro/entrega atómicos',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 const body={...data,metodo_pago:'TRANSFERENCIA',receta_path:hash+'/'+crypto.randomUUID()+'.png',items:[{id_medicamento:2,cantidad:1}]};
 const order=await create(db,body);assert.equal(order.receta_estado,'PENDIENTE');
 await assert.rejects(state(db,order.id_pedido,'PREPARANDO'),/valida la receta/);
 await assert.rejects(asUser(db,'warehouse',()=>db.query('select gestionar_pedido_portal($1,$2,$3)',[order.id_pedido,'receta','{"estado":"APROBADA"}'])),/permiso/);
 await manage(db,order.id_pedido,'receta',{estado:'APROBADA'});
 await state(db,order.id_pedido,'PREPARANDO');await state(db,order.id_pedido,'EN_CAMINO',{repartidor:'Repartidor de prueba'});
 await assert.rejects(state(db,order.id_pedido,'ENTREGADO'),/pago recibido/);
 await assert.rejects(manage(db,order.id_pedido,'pago',{estado:'PAGADO'}),/Referencia/);
 await manage(db,order.id_pedido,'pago',{estado:'RECHAZADO',referencia:'Intento rechazado'});
 assert.equal((await db.query('select count(*)::int n from ventas')).rows[0].n,0);
 await manage(db,order.id_pedido,'pago',{estado:'PAGADO',referencia:'TRANSFERENCIA-PRUEBA'});
 const ped=(await db.query('select estado,estado_pago from pedidos where id_pedido=$1',[order.id_pedido])).rows[0];assert.deepEqual(ped,{estado:'ENTREGADO',estado_pago:'PAGADO'});
 assert.equal((await db.query('select count(*)::int n from ventas')).rows[0].n,1);
 await assert.rejects(manage(db,order.id_pedido,'pago',{estado:'PAGADO',referencia:'Duplicado'}),/al recibir/);
 assert.equal((await db.query('select count(*)::int n from movimientos_caja where id_venta is not null')).rows[0].n,1);
 const track=(await db.query('select seguir_pedido_portal($1) data',[hash])).rows[0].data;
 assert.equal(track.receta_path,undefined);assert.equal(track.estado_pago,'PAGADO');
 assert.ok((await db.query('select count(*)::int n from notificaciones')).rows[0].n>=4);
});
test('cancelación y expiración liberan reservas una vez; no cancelan un pedido despachado',async t=>{
 const db=await testDatabase();t.after(()=>db.close());const first=await create(db);
 await db.query('select cancelar_pedido_portal($1)',[hash]);await db.query('select cancelar_pedido_portal($1)',[hash]);
 assert.equal(Number((await db.query('select sum(reservado) n from inventario')).rows[0].n),0);
 const second=await create(db,data,'c'.repeat(64));await db.query("update pedidos set expira_en=now()-interval '1 minute' where id_pedido=$1",[second.id_pedido]);
 assert.equal((await db.query('select expirar_pedidos_portal() n')).rows[0].n,1);
 assert.equal((await db.query('select expirar_pedidos_portal() n')).rows[0].n,0);
 const third=await create(db,data,'d'.repeat(64));await state(db,third.id_pedido,'PREPARANDO');await state(db,third.id_pedido,'EN_CAMINO',{repartidor:'Prueba'});
 await assert.rejects(db.query('select cancelar_pedido_portal($1)',['d'.repeat(64)]),/cancelar/);
 await assert.rejects(db.query('select cancelar_pedido_portal($1)',['invalid']),/no encontrado/);
});
test('contenido público filtrado y administración protegida; cupones no públicos',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 await asUser(db,'admin',()=>db.query("update contenidos set activo=false where tipo='VISION'"));
 assert.ok((await db.query("select count(*)::int n from auditoria where tabla='contenidos'")).rows[0].n>0);
 await db.exec('set role anon');
 try{const content=(await db.query('select contenido_publico() data')).rows[0].data;assert.ok(!content.some(row=>row.tipo==='VISION'));await assert.rejects(db.query('select * from cupones'),/permission/);await assert.rejects(db.query('select expirar_pedidos_portal()'),/permission/);await assert.rejects(db.query('select * from notificaciones'),/permission/);}finally{await db.exec('reset role');}
 await asUser(db,'vendor',async()=>{const result=await db.query("update contenidos set titulo='Cambio indebido'");assert.equal(result.affectedRows,0);});
});
