import { createAuthAdminClient } from '../config/database.js';
import { sendEmail, smtpTransport } from './email.js';
export async function processEmails(client=createAuthAdminClient()){
 // El bloqueo con arrendamiento se hace en SQL para no enviar la misma fila desde dos procesos.
 const designs=await client.from('plantillas_correo').select('*');if(designs.error)throw Error('No se pudieron cargar las plantillas');
 await client.rpc('encolar_recordatorios_eventos');
 const result=await client.rpc('tomar_correos',{p_destino:process.env.ALERT_EMAIL_TO||null});if(result.error)throw Error('No se pudo consultar la cola SMTP');
 for(const row of result.data){try{await sendEmail({to:row.destino,template:designs.data.find(t=>t.tipo===row.tipo)||designs.data.find(t=>t.tipo==='GENERAL'),actionUrl:row.action_url,event:row.evento,subject:'NexoFarma · '+row.evento,text:row.mensaje,messageId:'<nexo-'+row.tipo+'-'+row.id+'@nexofarma.local>'});const done=await client.rpc('cerrar_correo',{p_tipo:row.tipo,p_id:row.id,p_ok:true});if(done.error)throw Error('No se pudo registrar el envío');}catch{await client.rpc('cerrar_correo',{p_tipo:row.tipo,p_id:row.id,p_ok:false});}}
 return result.data.length;
}
export function startEmailWorker(){let running=false;const tick=async()=>{if(running)return;running=true;try{const transport=smtpTransport();try{await transport.verify();}finally{transport.close();}await processEmails();}catch{console.error('No se completó el ciclo de alertas/correos.');}finally{running=false;}};const timer=setInterval(tick,60000);timer.unref();tick();return()=>clearInterval(timer);}

export function startInventoryAlerts(){let running=false;async function tick(){if(running)return;running=true;try{const result=await createAuthAdminClient().rpc('generar_alertas_inventario');if(result.error)console.error('No se actualizaron las alertas de inventario.');}catch{console.error('No se actualizaron las alertas de inventario.');}finally{running=false;}}const timer=setInterval(tick,60000);timer.unref();tick();return()=>clearInterval(timer);}
