import { createClient } from '@supabase/supabase-js';

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from './config.js';

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
