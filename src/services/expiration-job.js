import { createAuthAdminClient } from '../config/database.js';
export function startExpirationJob({interval=60000}={}){
 let running=false;
 async function tick(){if(running)return;running=true;try{const result=await createAuthAdminClient().rpc('expirar_pedidos_portal');if(result.error)console.error('No se completó la expiración de reservas.');}catch{console.error('No se pudo ejecutar la expiración de reservas.');}finally{running=false;}}
 const timer=setInterval(tick,interval);timer.unref();tick();return()=>clearInterval(timer);
}
