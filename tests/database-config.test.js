import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseClient, databaseFailure } from '../scripts/database.js';

test('migraciones explican DATABASE_URL ausente sin intentar conexión', async function () {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    await assert.rejects(databaseClient(), { code: 'DATABASE_URL_MISSING' });
    assert.match(databaseFailure({ code: 'DATABASE_URL_MISSING' }), /Falta DATABASE_URL/);
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});

test('diagnóstico de errores no imprime mensajes que puedan contener credenciales', function () {
  const password = 'secreto-de-prueba';
  for (const code of ['28P01', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'UNKNOWN']) {
    const message = databaseFailure({ code, name: 'Error', message: `postgres://user:${password}@host/db` });
    assert.ok(!message.includes(password));
    assert.ok(!message.includes('postgres://'));
  }
});
