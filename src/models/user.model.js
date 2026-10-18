import { createSupabaseClient } from '../config/database.js';

// El modelo habla con Supabase. No recibe req ni envía respuestas HTTP.
const User = {
  login({ email, password }) {
    const supabase = createSupabaseClient();

    return supabase.auth.signInWithPassword({ email, password });
  },

  refresh(refreshToken) {
    const supabase = createSupabaseClient();
    return supabase.auth.refreshSession({ refresh_token: refreshToken });
  },
};

export default User;
