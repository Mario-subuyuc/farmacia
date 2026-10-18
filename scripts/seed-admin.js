// Seeder del administrador. La contraseña vive en .env, nunca en SQL.
function seedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function authAdmin() {
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) throw seedError('ADMIN_KEY_MISSING');
  const { createAuthAdminClient } = await import('../src/config/database.js');
  return createAuthAdminClient();
}

export async function seedAdministrator(client, config = process.env, getAdmin = authAdmin) {
  const email = (config.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  if (!email) return { skipped: true };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw seedError('ADMIN_EMAIL_INVALID');

  // Evita que dos seeders del mismo proyecto creen la cuenta simultáneamente.
  await client.query('select pg_advisory_lock(7062028)');
  try {
    const existing = await client.query('select id from auth.users where lower(email)=$1', [email]);
    let id = existing.rows[0]?.id;
    let created = false;
    if (!id) {
      const password = config.ADMIN_SEED_PASSWORD;
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw seedError('ADMIN_PASSWORD_MISSING');
      const admin = await getAdmin();
      // Supabase Auth cifra la contraseña y habilita esta cuenta inicial.
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { username: config.ADMIN_SEED_NAME || 'Administrador' },
      });
      if (error || !data?.user?.id) throw seedError('ADMIN_CREATE_FAILED');
      id = data.user.id;
      created = true;
      // DATABASE_URL y SUPABASE_URL deben pertenecer al mismo proyecto.
      const stored = await client.query('select id from auth.users where id=$1 and lower(email)=$2', [id, email]);
      if (!stored.rows.length) throw seedError('ADMIN_PROJECT_MISMATCH');
    }
    await client.query(`insert into public.perfiles(id_usuario,rol,id_sucursal,activo)
      values($1,'ADMIN',null,true)
      on conflict(id_usuario) do update set rol='ADMIN',id_sucursal=null,activo=true`, [id]);
    return { created, id };
  } finally {
    await client.query('select pg_advisory_unlock(7062028)');
  }
}
