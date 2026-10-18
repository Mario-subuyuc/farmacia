import { createAuthAdminClient } from '../config/database.js';
import { databaseError, httpError } from '../utils/http-error.js';

const Account = {
  async create(supabase, { username, email, password, rol, id_sucursal, activo }, admin = createAuthAdminClient()) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { username },
    });
    if (error) {
      if (['email_exists', 'user_already_exists'].includes(error.code)) throw httpError(409, 'Ya existe una cuenta con ese correo.');
      throw httpError(error.status >= 500 ? 503 : 400, 'No se pudo crear la cuenta. Revisa el correo, la contraseña y la configuración del servidor.');
    }
    // El perfil se guarda con el token del administrador conectado:
    // conserva permisos RLS y el actor de auditoría, sin guardar contraseñas.
    let profile;
    try {
      profile = await supabase.from('perfiles').insert({ id_usuario: data.user.id, rol, id_sucursal, activo }).select('*').single();
    } catch { profile = { error: { code: 'CONNECTION_ERROR' } }; }
    if (profile.error) {
      // Si falla el perfil, deshacemos únicamente la cuenta que acabamos de crear.
      let cleanup;
      try { cleanup = await admin.auth.admin.deleteUser(data.user.id); } catch { cleanup = { error: true }; }
      if (cleanup.error) throw httpError(503, 'Se creó la cuenta pero no su perfil. Revisa Authentication en Supabase antes de reintentar.');
      throw databaseError(profile.error);
    }
    return { ...profile.data, email: data.user.email, nombre: username };
  },
};
export default Account;
