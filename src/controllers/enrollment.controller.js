import {createHash,randomBytes} from 'node:crypto';
import PortalService from '../models/portal-service.model.js';
import {validateFields} from '../utils/validation.js';
import {httpError,databaseError} from '../utils/http-error.js';
import {processEmails} from '../services/email-worker.js';
import {publicSiteUrl} from '../config/config.js';
import {renderEmail} from '../services/email-template.js';
export const emailDesignFields={marca:{type:'text',max:80},lema:{type:'text',max:150},color_principal:{type:'color'},color_fondo:{type:'color'},color_alerta:{type:'color'},introduccion:{type:'text',max:500,nullable:true},pie:{type:'text',max:500},fuente:{type:'enum',values:['Arial','Georgia']}};
export async function previewEmail(req,res){const data=validateFields(req.body,emailDesignFields);res.json({html:renderEmail({subject:'Vista previa de tu correo',event:'RECORDATORIO_EVENTO',text:'Hola, te recordamos tu próxima actividad en la sucursal.\nAquí aparecerá la información del aviso.',template:data})});}
// Dependencias del servidor, reemplazables en pruebas; no se toman del HTTP.
export function createEnrollmentHandlers({adminClient=()=>PortalService.adminClient(),process=processEmails,logger=console}={}) {
 async function enviarCorreosPendientes(client,hash,event) {
  try {
   const result=await process(client,{enrollment:{hash,event},logger});
   if(result.sent===1)return {status:'SMTP_ACCEPTED'};
   return {status:result.failed || result.unrecorded ? 'PENDING_RETRY' : 'PENDING_OR_UNCHANGED'};
  }catch{
   logger.error('email.enrollment_processing_failed',{event});
   return {status:'PENDING_RETRY'};
  }
 }
 async function enroll(req,res) {
  const data=validateFields(req.body,{id_evento:{type:'number',min:1,max:Number.MAX_SAFE_INTEGER,integer:true},nombre:{type:'text',max:150},email:{type:'text',max:150},telefono:{type:'text',max:30,nullable:true}},['id_evento','nombre','email']);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw httpError(400,'Correo inválido.');
  let base;
  try { base=publicSiteUrl(); }catch { throw httpError(503,'Configura la URL pública del sitio.'); }
  const token=randomBytes(32).toString('hex');
  const hash=createHash('sha256').update(token).digest('hex');
  base.hash='inscripcion/'+token;
  const client=adminClient();
  const result=await client.rpc('inscribir_evento',{p_evento:data.id_evento,p_nombre:data.nombre,p_email:data.email,p_telefono:data.telefono||null,p_hash:hash,p_url:base.toString()});
  if(result.error)throw databaseError(result.error);
  // La inscripción ya está guardada; un fallo SMTP no debe deshacerla.
  const email=await enviarCorreosPendientes(client,hash,'CONFIRMAR_INSCRIPCION');
  const message=email.status==='SMTP_ACCEPTED'
   ? 'El servidor de correo aceptó el enlace de confirmación. Revisa tu bandeja y spam. El enlace vence en dos horas.'
   : 'Solicitud registrada. Si corresponde una nueva inscripción, el correo queda pendiente de envío. Si ya tenías una inscripción vigente, no se genera otro enlace. El enlace vence en dos horas.';
  res.status(202).json({message,email});
 }
 async function confirmEnrollment(req,res) {
  const data=validateFields(req.body,{token:{type:'text',max:64},cancelar:{type:'boolean'}},['token']);
  if(!/^[a-f0-9]{64}$/.test(data.token))throw httpError(400,'Código inválido.');
  const hash=createHash('sha256').update(data.token).digest('hex');
  const client=adminClient();
  const result=await client.rpc('confirmar_inscripcion',{p_hash:hash,p_cancelar:data.cancelar||false});
  if(result.error)throw databaseError(result.error);
  const email=data.cancelar ? {status:'NOT_APPLICABLE'} : await enviarCorreosPendientes(client,hash,'INSCRIPCION_CONFIRMADA');
  res.json({data:result.data,email,message:data.cancelar ? 'Inscripción cancelada.' : email.status==='SMTP_ACCEPTED'
   ? 'Inscripción confirmada. El servidor de correo aceptó el aviso de confirmación.'
   : 'Inscripción confirmada. El aviso por correo puede estar pendiente o haberse enviado anteriormente.'});
 }
 return {enroll,confirmEnrollment};
}
export const {enroll,confirmEnrollment}=createEnrollmentHandlers();
