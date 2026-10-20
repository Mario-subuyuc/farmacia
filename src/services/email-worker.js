import { createAuthAdminClient } from '../config/database.js';
import { sendEmail } from './email.js';

// Nunca registrar mensajes/respuestas libres del proveedor: pueden contener PII.
export function safeSmtpError(error) {
 const codes = new Set(['EAUTH','ECONNECTION','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ESOCKET','ETLS','EENVELOPE','EMESSAGE','EDNS']);
 return {
  code: codes.has(error?.code) ? error.code : 'EMAIL_FAILED',
  ...(Number.isInteger(error?.responseCode) && error.responseCode >= 100 && error.responseCode <= 599 ? {responseCode:error.responseCode} : {}),
 };
}

export async function processEmails(client=createAuthAdminClient(), {enrollment,send=sendEmail,logger=console}={}) {
 const designs=await client.from('plantillas_correo').select('*');
 if(designs.error)throw Error('No se pudieron cargar las plantillas');
 // La vía pública nunca encola recordatorios ni toma el lote general.
 if(!enrollment){
  const reminders=await client.rpc('encolar_recordatorios_eventos');
  if(reminders.error)throw Error('No se pudieron encolar los recordatorios');
 }
 const result=enrollment
  ? await client.rpc('tomar_correo_inscripcion',{p_hash:enrollment.hash,p_evento:enrollment.event})
  : await client.rpc('tomar_correos',{p_destino:process.env.ALERT_EMAIL_TO||null});
 if(result.error)throw Error('No se pudo reclamar la cola SMTP');
 const stats={claimed:result.data.length,sent:0,failed:0,unrecorded:0};
 for(const row of result.data){
  let accepted=false;
  const context={type:row.tipo,id:row.id,event:row.evento,attempt:row.intento};
  try{
   await send({to:row.destino,template:designs.data.find(t=>t.tipo===row.tipo)||designs.data.find(t=>t.tipo==='GENERAL'),actionUrl:row.action_url,event:row.evento,subject:'NexoFarma · '+row.evento,text:row.mensaje,messageId:'<nexo-'+row.tipo+'-'+row.id+'@nexofarma.local>'});
   accepted=true;
  }catch(error){logger.error('email.smtp_failed',{...context,...safeSmtpError(error)});}
  // Un fallo al registrar aceptación no debe tratarse como fallo SMTP.
  try{
   const done=row.tipo==='EVENTO'
    ? await client.rpc('cerrar_correo_inscripcion',{p_id:row.id,p_intento:row.intento,p_ok:accepted})
    : await client.rpc('cerrar_correo',{p_tipo:row.tipo,p_id:row.id,p_ok:accepted});
   if(done.error || (row.tipo==='EVENTO' && done.data!==true))throw Error('No se pudo cerrar el arrendamiento');
   if(accepted)stats.sent++;else stats.failed++;
   logger.info('email.completed',{...context,status:accepted?'SMTP_ACCEPTED':'RETRY_OR_ERROR'});
  }catch{
   stats.unrecorded++;
   logger.error('email.queue_finalize_failed',{...context,smtpAccepted:accepted});
  }
 }
 return stats;
}

export function startEmailWorker(){let running=false;const tick=async()=>{if(running)return;running=true;try{await processEmails();}catch{console.error('No se completó el ciclo de alertas/correos.');}finally{running=false;}};const timer=setInterval(tick,60000);timer.unref();tick();return()=>clearInterval(timer);}

export function startInventoryAlerts(){let running=false;async function tick(){if(running)return;running=true;try{const result=await createAuthAdminClient().rpc('generar_alertas_inventario');if(result.error)console.error('No se actualizaron las alertas de inventario.');}catch{console.error('No se actualizaron las alertas de inventario.');}finally{running=false;}}const timer=setInterval(tick,60000);timer.unref();tick();return()=>clearInterval(timer);}
