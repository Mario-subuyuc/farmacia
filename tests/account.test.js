import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test';
const { default: Account } = await import('../src/models/account.model.js');
const body = { username: 'Usuario Prueba', email: 'test@example.com', password: 'Test-secret-123', rol: 'VENDEDOR', id_sucursal: 1, activo: true };
function fixture(profileError, createError, cleanupError) {
  const calls = [];
  const admin = { auth: { admin: {
    createUser: async attrs => { calls.push(['create', attrs]); return { data: { user: { id: 'new-user', email: body.email } }, error: createError }; },
    deleteUser: async id => { calls.push(['delete', id]); return { error: cleanupError }; },
  } } };
  const db = { from: () => ({ insert: attrs => {
    calls.push(['profile', attrs]);
    return { select: () => ({ single: async () => ({ data: attrs, error: profileError }) }) };
  } }) };
  return { calls, admin, db };
}
test('crea cuenta y perfil, confirma acceso y no persiste contraseña en perfiles', async () => {
  const f = fixture();
  const result = await Account.create(f.db, body, f.admin);
  assert.equal(f.calls[0][1].email_confirm, true);
  assert.equal(f.calls[1][1].password, undefined);
  assert.equal(result.rol, 'VENDEDOR');
  assert.equal(result.password, undefined);
});
test('perfil fallido elimina únicamente la cuenta recién creada', async () => {
  const f = fixture({ code: '23503' });
  await assert.rejects(Account.create(f.db, body, f.admin), error => error.status === 400);
  assert.deepEqual(f.calls.at(-1), ['delete', 'new-user']);
});
test('correo duplicado no altera perfiles ni elimina cuentas existentes', async () => {
  const f = fixture(null, { code: 'email_exists' });
  await assert.rejects(Account.create(f.db, body, f.admin), error => error.status === 409);
  assert.equal(f.calls.length, 1);
});
test('si falla compensación avisa de cuenta pendiente en vez de informar éxito', async () => {
  const f = fixture({ code: '23503' }, null, { code: 'failure' });
  await assert.rejects(Account.create(f.db, body, f.admin), error => error.status === 503 && error.message.includes('no su perfil'));
});
