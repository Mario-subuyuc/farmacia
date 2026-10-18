import { httpError } from '../utils/http-error.js';
export function normalizeProductQuery(value) {
  if (typeof value !== 'string' || value.length > 100 || !/^[\p{L}\p{M}\p{N}\s.,¿?¡!()%-]*$/u.test(value)) throw httpError(400, 'Escribe el nombre del producto con letras y números, sin símbolos especiales.');
  const words = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  const stop = new Set(['hola','busco','buscar','quiero','necesito','tienen','tienes','hay','precio','cuesta','cuanto','que','cual','cuales','el','la','los','las','un','una','de','del','para','por','favor','me','puedes','dar','informacion','sobre','producto','productos','medicamento','medicamentos','disponible','disponibilidad','esta','este','tiene','en','y']);
  const query = words.filter(word => !stop.has(word)).join(' ');
  return query;
}
