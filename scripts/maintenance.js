import { deliverNotification } from '../src/services/notification-delivery.js';
import { databaseClient, databaseFailure } from './database.js';
let db;
try{
 db=await databaseClient();
 if(!process.argv.includes('--run')){
  const result=await db.query("select (select count(*) from pedidos where estado='PENDIENTE' and estado_pago<>'PAGADO' and expira_en<now())::int vencidos,(select count(*) from notificaciones where estado in ('PENDIENTE','ERROR'))::int avisos");
  console.log('Diagnóstico sin cambios:',result.rows[0]);
 }else{
  if(process.argv.includes('--retry-errors')){const result=await db.query("update notificaciones set estado='PENDIENTE',intentos=0,proximo_intento=now(),ultimo_error=null where estado='ERROR'");console.log('Avisos reencolados:',result.rowCount);}
  const expired=await db.query('select expirar_pedidos_portal() cantidad');console.log('Reservas vencidas liberadas:',expired.rows[0].cantidad);
  if(process.argv.includes('--send-notifications')){
   const endpoint=process.env.NOTIFICATION_WEBHOOK_URL,secret=process.env.NOTIFICATION_WEBHOOK_SECRET;
   if(!endpoint||!secret||secret.length<32||new URL(endpoint).protocol!=='https:')throw new Error('Configura un webhook HTTPS y un secreto de al menos 32 caracteres antes de enviar avisos.');
   await db.query("update notificaciones set estado='ERROR',ultimo_error='Se agotaron los reintentos; revisar proveedor' where estado='ENVIANDO' and intentos>=5 and proximo_intento<now()");
   const jobs=await db.query(`with pendientes as(select id_notificacion from notificaciones where intentos<5 and ((estado='PENDIENTE' and proximo_intento<=now()) or (estado='ENVIANDO' and proximo_intento<now())) order by id_notificacion for update skip locked limit 20)
    update notificaciones n set estado='ENVIANDO',intentos=intentos+1,proximo_intento=now()+interval '5 minutes' from pendientes p where n.id_notificacion=p.id_notificacion returning n.*`);
   for(const job of jobs.rows){
    try{await deliverNotification(job,{endpoint,secret});
     await db.query("update notificaciones set estado='ENVIADO',ultimo_error=null where id_notificacion=$1",[job.id_notificacion]);
    }catch{await db.query("update notificaciones set estado=case when intentos>=5 then 'ERROR' else 'PENDIENTE' end,proximo_intento=now()+make_interval(secs=>least(3600,30*power(2,intentos))::int),ultimo_error='No se confirmó el envío; revisar proveedor' where id_notificacion=$1",[job.id_notificacion]);}
   }
   console.log('Avisos procesados:',jobs.rowCount);
  }else console.log('Sin envío de avisos; se requiere --send-notifications y proveedor configurado.');
 }
}catch(error){console.error(error.code?databaseFailure(error):error.message);process.exitCode=1;}finally{await db?.end();}
