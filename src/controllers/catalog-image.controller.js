import { randomUUID } from 'node:crypto';
import { resources } from '../config/resources.js';
import * as Catalog from '../models/catalog.model.js';
import { positiveId } from '../utils/validation.js';
import { httpError } from '../utils/http-error.js';

export function imageExtension(body, type) {
  if (!Buffer.isBuffer(body) || !body.length) throw httpError(400, 'Selecciona una imagen JPEG, PNG o WebP.');
  if (type === 'image/jpeg' && body.subarray(0, 3).equals(Buffer.from([255,216,255]))) return 'jpg';
  if (type === 'image/png' && body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (type === 'image/webp' && body.toString('ascii',0,4) === 'RIFF' && body.toString('ascii',8,12) === 'WEBP') return 'webp';
  throw httpError(400, 'El contenido no corresponde a una imagen JPEG, PNG o WebP.');
}

export async function uploadImage(req, res) {
  const id = positiveId(req.params.id);
  const ext = imageExtension(req.body, req.get('Content-Type')?.split(';')[0]);
  const resource = resources.medicamentos;
  const previous = await Catalog.findRecord(req.supabase, resource, id);
  if (!previous) throw httpError(404, 'Medicamento no encontrado.');
  const bucket = req.supabase.storage.from('catalogo');
  const path = `medicamentos/${id}/${randomUUID()}.${ext}`;
  const { error } = await bucket.upload(path, req.body, { contentType: req.get('Content-Type'), upsert: false });
  if (error) throw httpError(503, 'No se pudo subir la imagen. Comprueba las migraciones y permisos de Storage.');
  const url = bucket.getPublicUrl(path).data.publicUrl;
  let record;
  try {
    record = await Catalog.updateRecord(req.supabase, resource, id, { imagen_url: url });
    if (!record) throw httpError(404, 'Medicamento no encontrado.');
  } catch (failure) {
    await bucket.remove([path]);
    throw failure;
  }
  // Conservamos las imágenes anteriores para no romper lecturas concurrentes.
  res.status(201).json({ data: record });
}
