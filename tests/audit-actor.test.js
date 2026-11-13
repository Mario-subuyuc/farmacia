import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, asUser, accounts, testSupabase } from './database-helper.js';
import { listRecords } from '../src/models/catalog.model.js';
import { resources } from '../src/config/resources.js';

test('auditoría identifica usuarios y mantiene el alcance por sucursal', async t => {
  const db = await testDatabase(); t.after(() => db.close());
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2', [{ username: 'Usuario de prueba' }, accounts.vendor]);
  await db.query("insert into auditoria(tabla,registro,accion,id_sucursal,actor) values('prueba','1','UPDATE',1,$1),('prueba','2','UPDATE',2,$1)", [accounts.vendor]);
  for (const role of ['admin', 'manager', 'auditor']) {
    const result = await asUser(db, role, () => listRecords(testSupabase(db), resources.auditoria, { tabla: 'prueba' }, { from: 0, to: 24 }));
    assert.equal(result.data.length, role === 'manager' ? 1 : 2);
    assert.ok(result.data.every(row => row.actor_usuario === 'Usuario de prueba'));
  }
  const hidden = await asUser(db, 'vendor', () => db.query('select * from auditoria_usuarios'));
  assert.equal(hidden.rows.length, 0);
});
