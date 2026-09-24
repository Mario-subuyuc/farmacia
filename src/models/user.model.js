import { createSupabaseClient } from '../config/database.js';

// Un cliente por operacion evita compartir sesiones entre peticiones.
const User = {
  register({ username, email, password }) {
    return createSupabaseClient().auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
  },

  login({ email, password }) {
    return createSupabaseClient().auth.signInWithPassword({ email, password });
  },
};

export default User;
