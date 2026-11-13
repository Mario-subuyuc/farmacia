import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, asUser, accounts, testSupabase } from './database-helper.js';
import { listRecords } from '../src/models/catalog.model.js';
import { resources } from '../src/config/resources.js';

test('administradores ven nombre y correo; otros roles no pueden consultar identidades', async t => {
  const db = await testDatabase();
  t.after(() => db.close());
  await db.query('update auth.users set email=$1, raw_user_meta_data=$2 where id=$3',
    ['persona@example.com', { username: 'Persona de prueba' }, accounts.vendor]);
  const result = await asUser(db, 'admin', () => listRecords(testSupabase(db), resources.perfiles, {}, { from: 0, to: 24 }));
  const account = result.data.find(row => row.id_usuario === accounts.vendor);
  assert.equal(account.email, 'persona@example.com');
  assert.equal(account.nombre, 'Persona de prueba');
  assert.equal('raw_user_meta_data' in account, false);
  const permissions = await asUser(db, 'admin', () => listRecords(testSupabase(db), resources['permisos-operativos'], {}, { from: 0, to: 24 }));
  const authorization = permissions.data.find(row => row.id_usuario === accounts.vendor);
  assert.equal(authorization.email, account.email);
  assert.equal(authorization.nombre, account.nombre);
  assert.equal(typeof authorization.aprobar_receta, 'boolean');
  for (const role of ['manager', 'vendor', 'auditor', 'callCenter', 'warehouse']) {
    const hidden = await asUser(db, role, () => db.query('select * from public.cuentas_personal'));
    assert.equal(hidden.rows.length, 0);
    assert.equal((await asUser(db, role, () => db.query('select * from public.autorizaciones_personal'))).rows.length, 0);
  }
  await db.exec(`update perfiles set activo=false where id_usuario='${accounts.admin}'`);
  assert.equal((await asUser(db, 'admin', () => db.query('select * from public.cuentas_personal'))).rows.length, 0);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.cuentas_personal'), /permission denied/);
  await db.exec('reset role');
});
