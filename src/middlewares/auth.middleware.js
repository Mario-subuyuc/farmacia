import { createSupabaseClient } from '../config/database.js';
import { httpError, databaseError } from '../utils/http-error.js';

// La fábrica facilita probar la verificación sin llamar al servicio remoto de Auth.
export function createAuthenticate(clientFactory = createSupabaseClient) {
  return async function (req, res, next) {
    const authorization = req.get('Authorization') || '';
    const match = authorization.match(/^Bearer (\S+)$/i);
    if (!match) throw httpError(401, 'Envía Authorization: Bearer <access_token>.');
    const token = match[1];
    const supabase = clientFactory(token);
    // getUser verifica el token con Supabase; no confiamos en un JWT solo decodificado.
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      if (error && (!error.status || error.status >= 500)) throw httpError(503, 'Autenticación no disponible.');
      throw httpError(401, 'Sesión inválida o vencida.');
    }
    const profile = await supabase.from('perfiles').select('*').eq('id_usuario', data.user.id).maybeSingle();
    if (profile.error) throw databaseError(profile.error);
    if (!profile.data || !profile.data.activo) throw httpError(403, 'Tu cuenta no tiene un perfil activo. Solicítalo al administrador.');
    req.user = data.user;
    req.profile = profile.data;
    req.supabase = supabase;
    next();
  };
}

export const authenticate = createAuthenticate();

export function authorize(roles) {
  return function (req, res, next) {
    if (!roles.includes(req.profile.rol)) throw httpError(403, 'Tu rol no tiene permiso para esta ruta.');
    next();
  };
}
