import {renderEmail} from './email-template.js';
import nodemailer from 'nodemailer';
export function smtpTransport(){return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',requireTLS:process.env.SMTP_SECURE!=='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:15000,socketTimeout:20000,logger:false,debug:false});}
export async function sendEmail({to,subject,text,messageId,event,template,actionUrl},transport=smtpTransport()){
 if(!to||/[\r\n]/.test(to)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))throw Error('Destinatario inválido');
 const result=await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,subject,text,html:renderEmail({subject,text,event,template,actionUrl}),messageId});
 if(result.rejected?.length||!result.accepted?.length)throw Error('SMTP no aceptó el destinatario');return {accepted:result.accepted,messageId:result.messageId};
}
