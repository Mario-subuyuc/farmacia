import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {deliverNotification} from '../src/services/notification-delivery.js';
test('avisos: firma verificable, identificador estable y rechazo de errores; sin envíos externos',async()=>{
 const job={id_notificacion:3,id_pedido:8,destino:'test@example.invalid',evento:'CONFIRMADO'},secret='x'.repeat(32);let calls=0;
 await deliverNotification(job,{endpoint:'https://provider.invalid/avisos',secret,fetcher:async(url,options)=>{calls++;assert.equal(options.headers['Idempotency-Key'],'nexo-notification-3');assert.equal(options.headers['X-Nexo-Signature'],createHmac('sha256',secret).update(options.headers['X-Nexo-Timestamp']+'.'+options.body).digest('hex'));assert.equal(JSON.parse(options.body).evento,'CONFIRMADO');assert.equal(options.redirect,'error');return {ok:true};}});
 assert.equal(calls,1);
 await assert.rejects(deliverNotification(job,{endpoint:'http://provider.invalid',secret,fetcher:()=>{calls++;}}),/HTTPS/);assert.equal(calls,1);
 await assert.rejects(deliverNotification(job,{endpoint:'https://provider.invalid',secret,fetcher:async()=>({ok:false})}),/confirmó/);
});
