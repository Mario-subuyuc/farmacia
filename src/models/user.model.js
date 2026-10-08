import { createSupabaseClient } from '../config/database.js';

// El modelo habla con Supabase. No recibe req ni envía respuestas HTTP.
const User = {
  register({ username, email, password }) {
    const supabase = createSupabaseClient();

    return supabase.auth.signUp({
      email,
      password,
      // Supabase guarda el nombre como información adicional del usuario.
      options: { data: { username } },
    });
  },

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
