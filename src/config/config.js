// Carga las variables de .env para leerlas con process.env.
import 'dotenv/config';

export const PORT = Number(process.env.PORT || 3000);

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map(function (origin) { return origin.trim(); });

// Si falta la configuración, detenemos el inicio con un mensaje claro.
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en .env'
  );
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT debe ser un puerto válido');
}



// Se valida antes de guardar una inscripción; no hay conexiones SMTP al arrancar.
export function publicSiteUrl(env = process.env) {
  const production = env.NODE_ENV === 'production' || Boolean(env.VERCEL);
  let url;
  try { url = new URL(env.PUBLIC_SITE_URL || (production ? '' : 'http://localhost:5173')); }
  catch { throw new Error('PUBLIC_SITE_URL debe contener la URL pública del frontend.'); }
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (production && (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.localhost') ||
       host === '[::1]' || host === '0.0.0.0' || /^127\./.test(host)))) {
    throw new Error('PUBLIC_SITE_URL debe ser una URL pública HTTPS en producción.');
  }
  url.hash = '';
  url.search = '';
  return url;
}
