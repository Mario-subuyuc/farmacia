import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, accounts } from './database-helper.js';
import { seedAdministrator } from '../scripts/seed-admin.js';

test('seeder del administrador usa SQL real y Auth simulado', async t => {
  const db = await testDatabase();
  t.after(() => db.close());
  await db.exec('alter table auth.users add column email text');
  // Datos ficticios: estas pruebas no leen tu contraseña ni crean cuentas remotas.
  const config = { ADMIN_SEED_EMAIL: ' Seed@Example.com ', ADMIN_SEED_PASSWORD: 'Secret-test-123', ADMIN_SEED_NAME: 'Mario' };
  let calls = 0;
  const newId = '88888888-8888-4888-8888-888888888888';
  const getAdmin = async () => ({ auth: { admin: { createUser: async body => {
    calls++;
    assert.equal(body.email_confirm, true);
    assert.equal(body.password, config.ADMIN_SEED_PASSWORD);
    await db.query('insert into auth.users(id,email) values($1,$2)', [newId, body.email]);
    return { data: { user: { id: newId } }, error: null };
  } } } });

  await t.test('crea cuenta confirmada y perfil ADMIN desde cero', async () => {
    const result = await seedAdministrator(db, config, getAdmin);
    assert.equal(result.created, true);
    const profile = (await db.query('select * from perfiles where id_usuario=$1', [newId])).rows[0];
    assert.equal(profile.rol, 'ADMIN');
    assert.equal(profile.activo, true);
    assert.equal(profile.id_sucursal, null);
  });
  await t.test('repetir conserva cuenta y contraseña; restaura perfil sin duplicar', async () => {
    await db.query("update perfiles set rol='VENDEDOR',id_sucursal=1,activo=false where id_usuario=$1", [newId]);
    const result = await seedAdministrator(db, { ADMIN_SEED_EMAIL: 'seed@example.com' }, getAdmin);
    assert.equal(result.created, false);
    assert.equal(calls, 1);
    const rows = (await db.query('select rol,activo from perfiles where id_usuario=$1', [newId])).rows;
    assert.deepEqual(rows, [{ rol: 'ADMIN', activo: true }]);
  });
  await t.test('cuenta existente sin perfil no requiere clave privada ni otra contraseña', async () => {
    await db.query('update auth.users set email=$1 where id=$2', ['existing@example.com', accounts.unassigned]);
    const result = await seedAdministrator(db, { ADMIN_SEED_EMAIL: 'existing@example.com' }, () => { throw new Error('No debe llamar Auth'); });
    assert.equal(result.created, false);
    assert.equal(result.id, accounts.unassigned);
  });
  await t.test('sin correo omite; contraseña ausente no crea cuenta ni perfil', async () => {
    assert.deepEqual(await seedAdministrator(db, {}), { skipped: true });
    await assert.rejects(seedAdministrator(db, { ADMIN_SEED_EMAIL: 'fresh@example.com' }, getAdmin), { code: 'ADMIN_PASSWORD_MISSING' });
    assert.equal(calls, 1);
  });
  await t.test('Auth fallido y proyecto diferente no crean perfil erróneo', async () => {
    const failAuth = async () => ({ auth: { admin: { createUser: async () => ({ error: { message: 'secret' } }) } } });
    await assert.rejects(seedAdministrator(db, { ...config, ADMIN_SEED_EMAIL: 'other@example.com' }, failAuth), { code: 'ADMIN_CREATE_FAILED' });
    const otherProject = async () => ({ auth: { admin: { createUser: async () => ({ data: { user: { id: '99999999-9999-4999-8999-999999999999' } } }) } } });
    await assert.rejects(seedAdministrator(db, { ...config, ADMIN_SEED_EMAIL: 'other@example.com' }, otherProject), { code: 'ADMIN_PROJECT_MISMATCH' });
    assert.equal((await db.query("select count(*)::int as total from perfiles where id_usuario='99999999-9999-4999-8999-999999999999'")).rows[0].total, 0);
  });
});
