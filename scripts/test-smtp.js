import 'dotenv/config';
import {smtpTransport,sendEmail} from '../src/services/email.js';
const transport=smtpTransport();
try{await transport.verify();for(const type of ['alerta de inventario','notificación de pedido']){const result=await sendEmail({to:process.env.SMTP_TEST_TO||process.env.ALERT_EMAIL_TO,subject:'[PRUEBA] NexoFarma · '+type,text:'Esta es una prueba técnica del sistema NexoFarma de '+type+'. No corresponde a un vencimiento, compra o movimiento real. Si ves este mensaje, el envío SMTP fue recibido por tu servidor de correo.'},transport);console.log('SMTP aceptó la prueba de '+type+':',result.messageId);}}
catch(error){console.error('No se completó la prueba SMTP:',error.code||'SMTP_ERROR','código de respuesta:',error.responseCode||'no disponible');process.exitCode=1;}finally{transport.close();}
