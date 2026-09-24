import { createClient } from '@supabase/supabase-js';

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from './config.js';

export const createSupabaseClient = () => {
  return createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
};