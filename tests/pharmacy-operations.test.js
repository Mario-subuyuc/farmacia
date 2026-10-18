import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase,asUser,operation} from './database-helper.js';
async function command(db,accion,datos,key=crypto.randomUUID(),user='admin'){return asUser(db,user,async()=>(await db.query('select operar_farmacia($1,$2,$3) data',[accion,JSON.stringify(datos),key])).rows[0].data);}
test('compras: recepción parcial, lotes, pagos e idempotencia',async t=>{
 const db=await testDatabase();t.after(()=>db.close());const provider=(await db.query("insert into proveedores(nombre) values('Prueba') returning id_proveedor")).rows[0].id_proveedor;
 const key=crypto.randomUUID(),body={id_sucursal:1,id_proveedor:provider,items:[{id_medicamento:1,cantidad:10,costo:3}]};const created=await command(db,'compra_crear',body,key);assert.deepEqual(await command(db,'compra_crear',body,key),created);
 const expiration=new Date(Date.now()+200*86400000).toISOString().slice(0,10);
 await command(db,'compra_recibir',{id_compra:created.id,factura:'F-1',items:[{id_medicamento:1,cantidad:4,lote:'COMPRA-1',fecha_vencimiento:expiration}]});
 assert.equal((await db.query('select estado from compras')).rows[0].estado,'PARCIAL');
 await assert.rejects(command(db,'compra_pagar',{id_compra:created.id,monto:13,metodo_pago:'EFECTIVO'}),/excede/);
 await command(db,'compra_pagar',{id_compra:created.id,monto:12,metodo_pago:'EFECTIVO'});
 await assert.rejects(command(db,'compra_recibir',{id_compra:created.id,factura:'F-1',items:[{id_medicamento:1,cantidad:-3,lote:'NEG',fecha_vencimiento:expiration}]}),/Cantidad/);
 await command(db,'compra_recibir',{id_compra:created.id,factura:'F-1',items:[{id_medicamento:1,cantidad:6,lote:'COMPRA-1',fecha_vencimiento:expiration}]});assert.equal((await db.query('select estado from compras')).rows[0].estado,'RECIBIDA');assert.equal((await db.query("select cantidad from inventario where lote='COMPRA-1'")).rows[0].cantidad,10);
});
test('conteos y bajas requieren aprobación; un conteo obsoleto no altera inventario',async t=>{
 const db=await testDatabase();t.after(()=>db.close());const lot=(await db.query('select * from inventario order by id_inventario limit 1')).rows[0];
 const req=await command(db,'solicitar_ajuste',{id_inventario:lot.id_inventario,tipo:'CONTEO',cantidad:80,motivo:'Conteo físico'},undefined,'warehouse').catch(()=>null);assert.equal(req,null);
 const count=await command(db,'solicitar_ajuste',{id_inventario:lot.id_inventario,tipo:'CONTEO',cantidad:80,motivo:'Conteo físico'});
 await db.query('update inventario set cantidad=cantidad+1 where id_inventario=$1',[lot.id_inventario]);await assert.rejects(command(db,'aprobar_ajuste',{id_solicitud:count.id,aprobar:true}),/cambió/);
 const removal=await command(db,'solicitar_ajuste',{id_inventario:lot.id_inventario,tipo:'BAJA',cantidad:2,motivo:'Producto dañado'});await command(db,'aprobar_ajuste',{id_solicitud:removal.id,aprobar:true});assert.equal((await db.query('select cantidad from inventario where id_inventario=$1',[lot.id_inventario])).rows[0].cantidad,lot.cantidad-1);
 await asUser(db,'admin',()=>db.query("update permisos_operativos set aprobar_stock=false where id_usuario=(select id_usuario from perfiles where rol='GERENTE' limit 1)"));
 await assert.rejects(command(db,'aprobar_ajuste',{id_solicitud:count.id,aprobar:false},undefined,'manager'),/autorización/);
});
test('devolución parcial reembolsa sin reponer stock ni permitir doble devolución; cierre detecta diferencia',async t=>{
 const db=await testDatabase();t.after(()=>db.close());const sale=await asUser(db,'admin',()=>operation(db,'venta',{id_sucursal:1,items:[{id_medicamento:1,cantidad:2}],metodo_pago:'EFECTIVO'}));const line=(await db.query('select * from detalle_venta where id_venta=$1',[sale.id_venta])).rows[0];
 await command(db,'devolucion_cliente',{id_detalle:line.id_detalle,cantidad:1,motivo:'Devolución revisada',metodo_pago:'EFECTIVO'});assert.equal(Number((await db.query('select reembolso from devoluciones_clientes')).rows[0].reembolso),10);
 await assert.rejects(command(db,'devolucion_cliente',{id_detalle:line.id_detalle,cantidad:2,motivo:'Duplicado',metodo_pago:'EFECTIVO'}),/excede/);
 await assert.rejects(asUser(db,'admin',()=>operation(db,'anular_venta',{id_venta:sale.id_venta,motivo:'Duplicado'})),/devoluciones/);
 const now=new Date().toISOString();const data={id_sucursal:1,desde:'2020-01-01T00:00:00Z',hasta:now,contado:0,nota:'Arqueo de prueba'};await command(db,'cierre_caja',data);const row=(await db.query('select * from cierres_caja')).rows[0];assert.equal(Number(row.diferencia),-Number(row.esperado));await assert.rejects(command(db,'cierre_caja',data),/cruza/);
});
