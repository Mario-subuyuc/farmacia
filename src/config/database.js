import { createClient } from '@supabase/supabase-js';

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from './config.js';
import { httpError } from '../utils/http-error.js';

// Exclusivo del servidor: administrar cuentas requiere una clave privada.
export function createAuthAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw httpError(503, 'Configura SUPABASE_SECRET_KEY en el .env del backend para crear usuarios.');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

// Cada operación usa su propio cliente para no compartir sesiones de usuarios.
export function createSupabaseClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    // Con el token, PostgreSQL sabe quién consulta y aplica sus permisos RLS.
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: {
      // El backend no guarda ni renueva la sesión del usuario.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
