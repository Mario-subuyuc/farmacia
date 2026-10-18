import PortalService from '../models/portal-service.model.js';
﻿import { createHash } from 'node:crypto';
import { validateFields } from '../utils/validation.js';
import { idField, paymentField } from '../config/resources.js';
import { validateOperation } from '../services/operation-validation.js';
import { httpError, databaseError } from '../utils/http-error.js';
const digest = value => createHash('sha256').update(value).digest('hex');
export function validateCheckout(body) {
  const text = max => ({ type: 'text', max });
  const fields = { nombre: text(100), apellido: text(100), telefono: text(20), direccion_entrega: text(255), id_sucursal: idField,
    latitud: { type: 'number', min: -90, max: 90 }, longitud: { type: 'number', min: -180, max: 180 },
    metodo_pago: paymentField, items: { type: 'array', max: 50 }, clave: {type:'uuid'}, token: text(64), email:{...text(150),nullable:true}, cupon:{...text(30),nullable:true}, receta_path:{...text(150),nullable:true},total_aceptado:{type:'number',min:0.01,max:999999999,money:true} };
  const clean = validateFields(body, fields, Object.keys(fields).filter(key=>!['email','cupon','receta_path','total_aceptado'].includes(key)));
  if (!/^[a-f0-9]{64}$/.test(clean.token) || !/^[+\d\s()-]{7,20}$/.test(clean.telefono)) throw httpError(400, 'Código privado o teléfono inválidos.');
  if(clean.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email))throw httpError(400,'Correo inválido.');
  if(clean.cupon&&!/^[A-Z0-9-]{3,30}$/.test(clean.cupon))throw httpError(400,'Cupón inválido.');
  if(clean.receta_path&&(!/^[a-f0-9]{64}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(clean.receta_path)||!clean.receta_path.startsWith(digest(clean.token)+'/')))throw httpError(400,'La receta no corresponde al código de este pedido.');
  clean.items = validateOperation('disponibilidad', { latitud: clean.latitud, longitud: clean.longitud, items: clean.items }).items;
  if (clean.items.some(item => item.cantidad > 99)) throw httpError(400, 'Máximo 99 unidades por medicamento.');
  return clean;
}
export async function checkout(req, res) {
  const {clave, token, ...data} = validateCheckout(req.body);
  const admin=PortalService.adminClient();
  if(data.receta_path){const [folder,name]=data.receta_path.split('/');const check=await admin.storage.from('recetas').list(folder,{search:name,limit:1});if(check.error||!check.data.some(file=>file.name===name))throw httpError(400,'La receta no está disponible. Vuelve a adjuntarla.');}
  const result = await admin.rpc('crear_pedido_portal', { p_datos: data, p_clave: clave, p_token_hash: digest(token) });
  if (result.error) throw databaseError(result.error);
  res.status(201).json({data: result.data, token});
}
export async function trackOrder(req, res) {
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw httpError(400, 'Introduce un código de seguimiento válido.');
  const result = await PortalService.adminClient().rpc('seguir_pedido_portal', {p_token_hash: digest(token)});
  if (result.error) throw databaseError(result.error);
  if (!result.data) throw httpError(404, 'Pedido no encontrado. Comprueba el código privado.');
  res.json({data:result.data});
}

export async function quoteOrder(req,res){const {clave,token,...data}=validateCheckout(req.body);const result=await PortalService.adminClient().rpc('cotizar_pedido_portal',{p_datos:data});if(result.error)throw databaseError(result.error);res.json({data:result.data});}
