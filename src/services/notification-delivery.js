import {createHmac} from 'node:crypto';
export async function deliverNotification(job,{endpoint,secret,fetcher=fetch}){
 if(!endpoint||!secret||secret.length<32||new URL(endpoint).protocol!=='https:')throw new Error('Configura un webhook HTTPS y un secreto de al menos 32 caracteres.');
 const body=JSON.stringify({id:job.id_notificacion,pedido:job.id_pedido,destino:job.destino,evento:job.evento});const stamp=String(Date.now());
 const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'nexo-notification-'+job.id_notificacion,'X-Nexo-Timestamp':stamp,'X-Nexo-Signature':createHmac('sha256',secret).update(stamp+'.'+body).digest('hex')},body,signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok)throw new Error('El proveedor no confirmó recepción.');
}
