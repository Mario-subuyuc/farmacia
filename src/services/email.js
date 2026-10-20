import {renderEmail} from './email-template.js';
import nodemailer from 'nodemailer';
export function smtpTransport(){return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',requireTLS:process.env.SMTP_SECURE!=='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false});}
export async function sendEmail({to,subject,text,messageId,event,template,actionUrl},transport){
 if(!to||/[\r\n]/.test(to)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))throw Error('Destinatario inválido');
 let link='';
 if(actionUrl){const url=new URL(actionUrl);if(!['http:','https:'].includes(url.protocol))throw Error('Enlace de correo inválido');link=url.toString();}
 const owned=!transport;
 transport ||= smtpTransport();
 try{
  const result=await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,subject,text:link?text+'\n\n'+link:text,html:renderEmail({subject,text,event,template,actionUrl:link}),messageId});
  if(result.rejected?.length||!result.accepted?.length)throw Object.assign(Error('SMTP no aceptó el destinatario'),{code:'EENVELOPE'});
  return {accepted:result.accepted,messageId:result.messageId};
 }finally{if(owned)transport.close();}
}
