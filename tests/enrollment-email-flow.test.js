import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {testDatabase,testSupabase} from './database-helper.js';
process.env.SUPABASE_URL='http://127.0.0.1:54321';
process.env.SUPABASE_PUBLISHABLE_KEY='test-public-key';
const {createEnrollmentHandlers}=await import('../src/controllers/enrollment.controller.js');
const {processEmails,safeSmtpError}=await import('../src/services/email-worker.js');
const {sendEmail}=await import('../src/services/email.js');
const {publicSiteUrl}=await import('../src/config/config.js');
const hash=token=>createHash('sha256').update(token).digest('hex');
const quiet={info(){},error(){}};
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test('flujo de inscripción con Supabase local simulado y SMTP sin red',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 const previous=process.env.PUBLIC_SITE_URL;
 process.env.PUBLIC_SITE_URL='https://farmacia-l8zr.vercel.app';
 t.after(()=>{if(previous===undefined)delete process.env.PUBLIC_SITE_URL;else process.env.PUBLIC_SITE_URL=previous;});
 const client=testSupabase(db);
 const event=(await db.query("insert into eventos(id_sucursal,titulo,descripcion,inicio,fin,publicado,cupo) values(1,'Taller','Prueba',now()+interval '12 hours',now()+interval '13 hours',true,20) returning id_evento")).rows[0].id_evento;
 const payload=email=>({id_evento:event,nombre:'Persona',email});
 const messages=[],logs=[];
 let fail=false,waitForSend;
 const send=async mail=>{
  messages.push(mail);
  if(waitForSend)await waitForSend;
  return sendEmail(mail,{sendMail:async actual=>{
   assert.ok(actual.html.includes('NexoFarma'));
   if(mail.actionUrl)assert.ok(actual.text.includes(mail.actionUrl));
   if(fail)throw Object.assign(Error('secret-password token https://private/link body'),{code:'EAUTH',command:'AUTH secret',responseCode:535,response:'private'});
   return {accepted:[actual.to],rejected:[],messageId:'simulated'};
  }});
 };
 const processor=(c,options)=>processEmails(c,{...options,send});
 const handlers=createEnrollmentHandlers({adminClient:()=>client,process:processor,logger:{info:(...a)=>logs.push(a),error:(...a)=>logs.push(a)}});
 let token;
 await t.test('guarda, espera SMTP, marca ENVIADO y no procesa a otra persona',async()=>{
  await client.rpc('inscribir_evento',{p_evento:event,p_nombre:'Otra',p_email:'other@example.invalid',p_telefono:null,p_hash:'a'.repeat(64),p_url:'https://farmacia-l8zr.vercel.app/#inscripcion/'+ 'a'.repeat(64)});
  let release;waitForSend=new Promise(resolve=>{release=resolve;});
  const res=response();const work=handlers.enroll({body:payload('valid@example.invalid')},res);
  // Da oportunidad a SQL y al controlador de llegar hasta el envío bloqueado.
  for(let i=0;i<100 && !messages.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(messages.length,1);assert.equal(res.body,undefined);
  release();await work;waitForSend=undefined;
  assert.equal(res.statusCode,202);assert.equal(res.body.email.status,'SMTP_ACCEPTED');
  const url=new URL(messages[0].actionUrl);assert.equal(url.origin,'https://farmacia-l8zr.vercel.app');
  token=url.hash.slice('#inscripcion/'.length);assert.match(token,/^[a-f0-9]{64}$/);
  const ins=(await db.query("select * from inscripciones where email='valid@example.invalid'")).rows[0];
  assert.equal(ins.token_hash,hash(token));assert.equal(ins.estado,'PENDIENTE');
  const rows=(await db.query('select destino,estado,intentos from privado.correos_eventos order by id')).rows;
  assert.deepEqual(rows.map(r=>[r.estado,r.intentos]),[['PENDIENTE',0],['ENVIADO',1]]);
  assert.ok(!logs.flat().some(x=>typeof x==='object' && 'destino' in x));
 });
 await t.test('repetir inscripción vigente no genera ni envía otro enlace',async()=>{
  const count=messages.length,res=response();await handlers.enroll({body:payload('valid@example.invalid')},res);
  assert.equal(messages.length,count);assert.equal(res.body.email.status,'PENDING_OR_UNCHANGED');
  assert.equal((await db.query("select token_hash from inscripciones where email='valid@example.invalid'")).rows[0].token_hash,hash(token));
 });
 await t.test('confirma el token actual y envía un único aviso; repetición no duplica',async()=>{
  const res=response();await handlers.confirmEnrollment({body:{token}},res);
  assert.equal(res.body.data.estado,'CONFIRMADA');assert.equal(res.body.email.status,'SMTP_ACCEPTED');
  assert.equal(messages.at(-1).event,'INSCRIPCION_CONFIRMADA');
  assert.equal((await db.query('select estado from inscripciones where token_hash=$1',[hash(token)])).rows[0].estado,'CONFIRMADA');
  const count=messages.length;const again=response();await handlers.confirmEnrollment({body:{token}},again);
  assert.equal(messages.length,count);assert.equal(again.body.email.status,'PENDING_OR_UNCHANGED');
  assert.equal((await db.query("select count(*)::int n from privado.correos_eventos where evento='INSCRIPCION_CONFIRMADA' and estado='ENVIADO'")).rows[0].n,1);
 });
 await t.test('SMTP falla: conserva inscripción y registra espera, sin anunciar enviado',async()=>{
  fail=true;const res=response();await handlers.enroll({body:payload('retry@example.invalid')},res);fail=false;
  assert.equal(res.statusCode,202);assert.equal(res.body.email.status,'PENDING_RETRY');assert.ok(!res.body.message.includes('aceptó'));
  const row=(await db.query("select c.*,i.estado ins_estado from privado.correos_eventos c join inscripciones i using(id_inscripcion) where i.email='retry@example.invalid'")).rows[0];
  assert.equal(row.ins_estado,'PENDIENTE');assert.equal(row.estado,'PENDIENTE');assert.equal(row.intentos,1);
  assert.ok(new Date(row.proximo_intento)>new Date());
  const privateToken=new URL(messages.at(-1).actionUrl).hash.slice(13);
  assert.deepEqual((await client.rpc('tomar_correo_inscripcion',{p_hash:hash(privateToken),p_evento:'CONFIRMAR_INSCRIPCION'})).data,[]);
  await db.query('update privado.correos_eventos set proximo_intento=now() where id=$1',[row.id]);
  const stats=await processEmails(client,{enrollment:{hash:hash(privateToken),event:'CONFIRMAR_INSCRIPCION'},send,logger:quiet});
  assert.equal(stats.sent,1);
  const serialized=JSON.stringify(logs);for(const secret of ['secret-password','https://private','AUTH secret','"destino"',privateToken,hash(privateToken)])assert.ok(!serialized.includes(secret));
  assert.ok(serialized.includes('EAUTH'));assert.ok(serialized.includes('535'));
 });
 await t.test('SMTP falla al confirmar: estado CONFIRMADA se conserva y el aviso se reintenta',async()=>{
  await handlers.enroll({body:payload('confirm-retry@example.invalid')},response());
  const confirmationToken=new URL(messages.at(-1).actionUrl).hash.slice(13);
  fail=true;const res=response();await handlers.confirmEnrollment({body:{token:confirmationToken}},res);fail=false;
  assert.equal(res.body.data.estado,'CONFIRMADA');assert.equal(res.body.email.status,'PENDING_RETRY');
  const row=(await db.query("select c.*,i.estado ins_estado from privado.correos_eventos c join inscripciones i using(id_inscripcion) where i.email='confirm-retry@example.invalid' and c.evento='INSCRIPCION_CONFIRMADA'")).rows[0];
  assert.equal(row.ins_estado,'CONFIRMADA');assert.equal(row.estado,'PENDIENTE');assert.equal(row.intentos,1);
  await db.query('update privado.correos_eventos set proximo_intento=now() where id=$1',[row.id]);
  const retry=response();await handlers.confirmEnrollment({body:{token:confirmationToken}},retry);
  assert.equal(retry.body.email.status,'SMTP_ACCEPTED');
  assert.equal((await db.query("select count(*)::int n from privado.correos_eventos where id_inscripcion=$1 and evento='INSCRIPCION_CONFIRMADA'",[row.id_inscripcion])).rows[0].n,1);
 });
 await t.test('fallo de cola después de guardar no pierde la inscripción',async()=>{
  const broken=createEnrollmentHandlers({adminClient:()=>client,process:async()=>{throw Error('private');},logger:quiet});
  const res=response();await broken.enroll({body:payload('queue-fail@example.invalid')},res);
  assert.equal(res.body.email.status,'PENDING_RETRY');
  assert.equal((await db.query("select estado from inscripciones where email='queue-fail@example.invalid'")).rows[0].estado,'PENDIENTE');
 });
 await t.test('token malformado, desconocido y vencido no envían ni confirman',async()=>{
  const count=messages.length;
  await assert.rejects(handlers.confirmEnrollment({body:{token:'bad'}},response()),e=>e.status===400);
  await assert.rejects(handlers.confirmEnrollment({body:{token:'f'.repeat(64)}},response()),e=>e.status===404);
  const expiredToken='c'.repeat(64);
  await client.rpc('inscribir_evento',{p_evento:event,p_nombre:'Expirada',p_email:'expired@example.invalid',p_hash:hash(expiredToken),p_url:'https://farmacia-l8zr.vercel.app',p_telefono:null});
  await db.query('update inscripciones set expira_en=now()-interval \'1 minute\' where token_hash=$1',[hash(expiredToken)]);
  await assert.rejects(handlers.confirmEnrollment({body:{token:expiredToken}},response()),e=>e.status===409);
  assert.equal(messages.length,count);
 });
 await t.test('cancelar no procesa otros correos',async()=>{
  const count=messages.length,res=response();await handlers.confirmEnrollment({body:{token,cancelar:true}},res);
  assert.equal(res.body.data.estado,'CANCELADA');assert.equal(res.body.email.status,'NOT_APPLICABLE');assert.equal(messages.length,count);
 });
});

test('selección acotada, leases, intentos y exclusión de enlaces antiguos',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 const event=(await db.query("insert into eventos(id_sucursal,titulo,descripcion,inicio,fin,publicado) values(1,'Actividad','Prueba',now()+interval '12 hours',now()+interval '13 hours',true) returning id_evento")).rows[0].id_evento;
 const enroll=h=>db.query('select inscribir_evento($1,$2,$3,null,$4,$5)',[event,'Persona','old@example.invalid',h,'https://farmacia-l8zr.vercel.app/#inscripcion/'+h]);
 const claim=h=>db.query("select tomar_correo_inscripcion($1,'CONFIRMAR_INSCRIPCION') data",[h]);
 const old='1'.repeat(64),current='2'.repeat(64);
 await enroll(old);await db.query("update inscripciones set expira_en=now()-interval '1 minute'");await enroll(current);
 assert.deepEqual((await claim(old)).rows[0].data,[]);
 await assert.rejects(db.query('select confirmar_inscripcion($1,false)',[old]),/no encontrado/);
 const first=(await claim(current)).rows[0].data;assert.equal(first.length,1);assert.equal(first[0].intento,1);
 assert.deepEqual((await claim(current)).rows[0].data,[]);
 assert.deepEqual((await db.query('select tomar_correos(null) data')).rows[0].data,[]);
 await db.query("update privado.correos_eventos set proximo_intento=now()-interval '1 second' where id=$1",[first[0].id]);
 const second=(await db.query('select tomar_correos(null) data')).rows[0].data;
 assert.equal(second.length,1);assert.equal(second[0].id,first[0].id);assert.equal(second[0].intento,2);
 assert.equal((await db.query('select cerrar_correo_inscripcion($1,1,true) ok',[first[0].id])).rows[0].ok,false);
 assert.equal((await db.query('select cerrar_correo_inscripcion($1,2,false) ok',[first[0].id])).rows[0].ok,true);
 await db.query("update privado.correos_eventos set intentos=4,proximo_intento=now() where id=$1",[first[0].id]);
 const fifth=(await claim(current)).rows[0].data[0];assert.equal(fifth.intento,5);
 await db.query('select cerrar_correo_inscripcion($1,$2,false)',[fifth.id,fifth.intento]);
 assert.equal((await db.query('select estado from privado.correos_eventos where id=$1',[fifth.id])).rows[0].estado,'ERROR');
 assert.deepEqual((await claim(current)).rows[0].data,[]);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  try{await assert.rejects(claim(current),/permission/);await assert.rejects(db.query('select cerrar_correo_inscripcion(1,1,true)'),/permission/);}finally{await db.exec('reset role');}
 }
});

test('PUBLIC_SITE_URL obligatoria y HTTPS pública en producción',()=>{
 assert.equal(publicSiteUrl({NODE_ENV:'production',PUBLIC_SITE_URL:'https://farmacia-l8zr.vercel.app'}).origin,'https://farmacia-l8zr.vercel.app');
 for(const url of [undefined,'bad','http://farmacia-l8zr.vercel.app','https://localhost','https://127.0.0.1','https://[::1]','https://user:pass@example.com']){
  assert.throws(()=>publicSiteUrl({VERCEL:'1',PUBLIC_SITE_URL:url}));
 }
 assert.equal(publicSiteUrl({NODE_ENV:'development'}).origin,'http://localhost:5173');
 assert.deepEqual(safeSmtpError({code:'secret',responseCode:'token',message:'secret',command:'AUTH secret'}),{code:'EMAIL_FAILED'});
});

test('SMTP aceptó pero falla el cierre: no marcar como fallo SMTP ni anunciar enviado',async()=>{
 const calls=[],logs=[];
 const client={from:()=>({select:async()=>({data:[],error:null})}),rpc:async(name,args)=>{
  calls.push([name,args]);
  return name==='tomar_correo_inscripcion'?{data:[{tipo:'EVENTO',id:7,intento:1,evento:'CONFIRMAR_INSCRIPCION'}]}:{error:{code:'offline'}};
 }};
 const stats=await processEmails(client,{enrollment:{hash:'a'.repeat(64),event:'CONFIRMAR_INSCRIPCION'},send:async()=>{},logger:{info(){},error:(...a)=>logs.push(a)}});
 assert.deepEqual(stats,{claimed:1,sent:0,failed:0,unrecorded:1});
 assert.equal(calls.length,2);assert.equal(calls[1][1].p_ok,true);
 assert.equal(logs[0][0],'email.queue_finalize_failed');assert.equal(logs[0][1].smtpAccepted,true);
});
