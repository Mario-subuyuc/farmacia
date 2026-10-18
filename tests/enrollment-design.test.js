import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase,asUser} from './database-helper.js';
import {renderEmail} from '../src/services/email-template.js';
test('inscripción con confirmación: cupo, expiración, cancelación y recordatorio sin duplicados',async t=>{
 const db=await testDatabase();t.after(()=>db.close());const event=(await db.query("insert into eventos(id_sucursal,titulo,descripcion,inicio,fin,publicado,cupo) values(1,'Actividad','Prueba',now()+interval '12 hours',now()+interval '13 hours',true,1) returning id_evento")).rows[0].id_evento;
 const enroll=(email,hash)=>db.query('select inscribir_evento($1,$2,$3,$4,$5,$6)',[event,'Persona',email,null,hash,'http://localhost/#inscripcion/token']);
 await enroll('test@example.invalid','a'.repeat(64));await enroll('test@example.invalid','b'.repeat(64));assert.equal((await db.query('select count(*)::int n from inscripciones')).rows[0].n,1);
 await assert.rejects(enroll('other@example.invalid','c'.repeat(64)),/cupos/);
 await db.query('select confirmar_inscripcion($1,false)',['a'.repeat(64)]);await db.query('select confirmar_inscripcion($1,false)',['a'.repeat(64)]);
 assert.equal((await db.query('select encolar_recordatorios_eventos() n')).rows[0].n,1);assert.equal((await db.query('select encolar_recordatorios_eventos() n')).rows[0].n,0);
 const queue=(await db.query('select tomar_correos(null) data')).rows[0].data;assert.ok(queue.some(row=>row.tipo==='EVENTO'&&row.evento==='RECORDATORIO_EVENTO'));
 for(const row of queue)await db.query('select cerrar_correo($1,$2,true)',[row.tipo,row.id]);
 await db.query('select confirmar_inscripcion($1,true)',['a'.repeat(64)]);await enroll('other@example.invalid','c'.repeat(64));
 await db.query("update inscripciones set expira_en=now()-interval '1 minute' where token_hash=$1",['c'.repeat(64)]);await assert.rejects(db.query('select confirmar_inscripcion($1,false)',['c'.repeat(64)]),/venció/);
 await db.exec('set role anon');try{await assert.rejects(db.query('select * from inscripciones'),/permission/);await assert.rejects(db.query('select encolar_recordatorios_eventos()'),/permission/);}finally{await db.exec('reset role');}
});
test('plantillas: personalización escapada y permisos de administración',async t=>{
 const db=await testDatabase();t.after(()=>db.close());await asUser(db,'admin',()=>db.query("update plantillas_correo set marca='Mi farmacia',color_principal='#123456' where tipo='EVENTO'"));
 const template=(await db.query("select * from plantillas_correo where tipo='EVENTO'")).rows[0];const html=renderEmail({subject:'Actividad',text:'Mensaje',template,actionUrl:'javascript:alert(1)'});assert.ok(html.includes('Mi farmacia'));assert.ok(html.includes('#123456'));assert.ok(!html.includes('javascript:'));
 await assert.rejects(db.query("update plantillas_correo set color_principal='red;position:fixed'"),/constraint|too long/);
 await asUser(db,'vendor',async()=>{assert.equal((await db.query('select * from plantillas_correo')).rows.length,0);});
});
