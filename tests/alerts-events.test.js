import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase,asUser} from './database-helper.js';
import {sendEmail} from '../src/services/email.js';
test('alertas reales: vencidos, próximos, reposición, deduplicación y cola',async t=>{
 const db=await testDatabase();t.after(()=>db.close());await db.query("update inventario set fecha_vencimiento=current_date-1 where id_inventario=(select min(id_inventario) from inventario)");
 await db.query("update inventario set fecha_vencimiento=current_date+10 where id_inventario=(select max(id_inventario) from inventario)");
 await db.query('select generar_alertas_inventario()');const rows=(await db.query("select * from alertas_inventario where estado='ACTIVA'")).rows;
 for(const tipo of ['VENCIDO','POR_VENCER','STOCK_BAJO'])assert.ok(rows.some(row=>row.tipo===tipo));
 await db.query('select generar_alertas_inventario()');assert.equal((await db.query('select count(*)::int n from alertas_inventario')).rows[0].n,rows.length);
 const messages=(await db.query("select tomar_correos('test@example.invalid') data")).rows[0].data;assert.ok(messages.length>0);
 const rest=(await db.query("select tomar_correos('test@example.invalid') data")).rows[0].data;assert.ok(rest.every(row=>!messages.some(first=>first.id===row.id)));messages.push(...rest);
 for(const row of messages)await db.query('select cerrar_correo($1,$2,true)',[row.tipo,row.id]);
 await db.query('select generar_alertas_inventario()');assert.equal((await db.query("select tomar_correos('test@example.invalid') data")).rows[0].data.length,0);
 await asUser(db,'vendor',async()=>{assert.equal((await db.query('select * from alertas_inventario')).rows.length,0);});
});
test('proveedores y eventos: solo administrador publica; calendario no revela borradores',async t=>{
 const db=await testDatabase();t.after(()=>db.close());await asUser(db,'admin',()=>db.query("insert into proveedores(nombre,email) values('Proveedor de prueba','proveedor@example.invalid')"));
 await asUser(db,'admin',()=>db.query("insert into eventos(id_sucursal,titulo,descripcion,inicio,fin,publicado) values(1,'Taller público','Descripción de prueba','2026-10-20 10:00-06','2026-10-20 12:00-06',true),(1,'Borrador','Privado','2026-10-20 10:00-06','2026-10-20 12:00-06',false)"));
 await db.exec('set role anon');try{const events=(await db.query("select eventos_publicos('2026-10-01','2026-11-01') data")).rows[0].data;assert.equal(events.length,1);assert.equal(events[0].title,'Taller público');await assert.rejects(db.query('select * from proveedores'),/permission/);await assert.rejects(db.query('select generar_alertas_inventario()'),/permission/);}finally{await db.exec('reset role');}
 await assert.rejects(asUser(db,'manager',()=>db.query("insert into proveedores(nombre) values('No permitido')")),/policy|permission/);
 await assert.rejects(db.query("insert into eventos(id_sucursal,titulo,descripcion,inicio,fin) values(1,'Mal','Mal','2026-10-20','2026-10-19')"),/constraint/);
});
test('SMTP valida destinatario y comprueba aceptación sin usar la red',async()=>{
 let calls=0;const transport={sendMail:async msg=>{calls++;assert.equal(msg.to,'test@example.invalid');return{accepted:[msg.to],rejected:[],messageId:'local-test'};}};
 assert.equal((await sendEmail({to:'test@example.invalid',subject:'Prueba',text:'Simulado'},transport)).messageId,'local-test');
 await assert.rejects(sendEmail({to:'test@example.invalid\r\nBcc:other@example.invalid'},transport));assert.equal(calls,1);
 await assert.rejects(sendEmail({to:'test@example.invalid'},{sendMail:async()=>({accepted:[],rejected:['test@example.invalid']})}));
});
