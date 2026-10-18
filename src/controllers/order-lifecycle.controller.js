import PublicCatalog from '../models/public-catalog.model.js';
import PortalService from '../models/portal-service.model.js';
﻿import { createHash, randomUUID } from 'node:crypto';
import { imageExtension } from './catalog-image.controller.js';
import { httpError, databaseError } from '../utils/http-error.js';
import { positiveId, validateFields } from '../utils/validation.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
function tokenHash(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw httpError(400,'Código privado inválido.');return hash(value);}
export async function publicContent(req,res){const result=await PublicCatalog.content();if(result.error)throw databaseError(result.error);res.json({data:result.data});}
export async function uploadPrescription(req,res){
 const folder=tokenHash(req.get('X-Upload-Token'));
 const ext=imageExtension(req.body,req.get('Content-Type')?.split(';')[0]);
 const path=`${folder}/${randomUUID()}.${ext}`;
 const result=await PortalService.adminClient().storage.from('recetas').upload(path,req.body,{contentType:req.get('Content-Type'),upsert:false});
 if(result.error)throw httpError(503,'No se pudo guardar la receta.');
 res.status(201).json({data:{path}});
}
export async function prescriptionLink(req,res){
 const id=positiveId(req.params.id);
 // El cliente del usuario aplica RLS; además se limita la lectura a roles de atención.
 const result=await req.supabase.from('pedidos').select('id_sucursal,receta_path').eq('id_pedido',id).maybeSingle();
 if(result.error)throw databaseError(result.error);
 if(!result.data?.receta_path)throw httpError(404,'No hay receta accesible para este pedido.');
 if(req.profile.rol!=='ADMIN'&&Number(result.data.id_sucursal)!==Number(req.profile.id_sucursal))throw httpError(403,'La receta corresponde a otra sucursal.');
 const link=await PortalService.adminClient().storage.from('recetas').createSignedUrl(result.data.receta_path,120);
 if(link.error)throw httpError(503,'No se pudo abrir la receta.');res.json({data:{url:link.data.signedUrl}});
}
export async function managePortalOrder(req,res){
 const id=positiveId(req.params.id);
 const data=validateFields(req.body,{accion:{type:'enum',values:['receta','pago']},estado:{type:'enum',values:['APROBADA','RECHAZADA','PAGADO','RECHAZADO']},referencia:{type:'text',max:150}},['accion','estado']);
 const result=await req.supabase.rpc('gestionar_pedido_portal',{p_id:id,p_accion:data.accion,p_datos:{estado:data.estado,referencia:data.referencia}});
 if(result.error)throw databaseError(result.error);res.json({data:result.data});
}
export async function cancelPortalOrder(req,res){
 const data=validateFields(req.body,{token:{type:'text',max:64}},['token']);
 const result=await PortalService.adminClient().rpc('cancelar_pedido_portal',{p_token_hash:tokenHash(data.token)});
 if(result.error)throw databaseError(result.error);res.json({data:result.data});
}
