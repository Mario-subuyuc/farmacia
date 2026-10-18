import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/services/api-client.js';

function response(status, data) { return { status, ok: status >= 200 && status < 300, json: async () => data }; }
function session(token = 'old') { return { user: { id: 'user' }, session: { access_token: token, refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 } }; }

test('envía token y clave de idempotencia sin enviar contraseña', async function () {
  let saved = session(); const calls = [];
  const api = createApi({ baseUrl: 'http://test/api', getSession: () => saved, setSession: value => { saved = value; }, fetcher: async (url, options) => { calls.push({ url, options }); return response(201, { data: { id_venta: 1 } }); } });
  await api.write('POST', '/ventas', { items: [] }, 'uuid');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer old');
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'uuid');
  assert.ok(!calls[0].options.body.includes('password'));
});
test('dos 401 simultáneos renuevan una vez y conservan la misma operación al reintentar', async function () {
  let saved = session(); let renewals = 0; const keys = [];
  const api = createApi({ baseUrl: 'http://test/api', getSession: () => saved, setSession: value => { saved = value; }, fetcher: async (url, options) => {
    if (url.endsWith('/refresh')) { renewals++; await new Promise(resolve => setTimeout(resolve, 5)); return response(200, session('new')); }
    keys.push(options.headers['Idempotency-Key']);
    return options.headers.Authorization === 'Bearer old' ? response(401, { message: 'expired' }) : response(201, { data: { id_venta: 1 } });
  } });
  await Promise.all([api.write('POST', '/ventas', {}, 'key-one'), api.write('POST', '/ventas', {}, 'key-two')]);
  assert.equal(renewals, 1); assert.deepEqual(keys, ['key-one', 'key-two', 'key-one', 'key-two']);
});
test('renovación inválida elimina la sesión; un 403 conserva la identidad', async function () {
  let saved = session();
  const api = createApi({ baseUrl: 'http://test/api', getSession: () => saved, setSession: value => { saved = value; }, fetcher: async url => response(401, { message: url.endsWith('/refresh') ? 'refresh invalid' : 'expired' }) });
  await assert.rejects(api.get('/me')); assert.equal(saved, null);
  saved = session();
  const forbidden = createApi({ baseUrl: 'http://test/api', getSession: () => saved, setSession: value => { saved = value; }, fetcher: async () => response(403, { message: 'Sin perfil' }) });
  await assert.rejects(forbidden.get('/me'), /Sin perfil/); assert.ok(saved);
});
test('paginación carga todas las opciones y errores de red son explícitos', async function () {
  const api = createApi({ baseUrl: 'http://test/api', getSession: () => session(), setSession: () => {}, fetcher: async url => {
    const page = Number(new URL(url).searchParams.get('page'));
    return response(200, { data: Array.from({ length: page === 1 ? 100 : 1 }, (_, i) => ({ id: (page - 1) * 100 + i + 1 })), pagination: { total: 101 } });
  } });
  assert.equal((await api.getAll('/medicamentos')).length, 101);
  const offline = createApi({ baseUrl: 'http://test/api', getSession: () => null, setSession: () => {}, fetcher: async () => { throw new Error('offline'); } });
  await assert.rejects(offline.get('/me'), error => error.network && /servidor/.test(error.message));
});
test('logout durante la renovación no restaura una sesión cerrada', async function () {
  let saved = session(); let release;
  const pending = new Promise(resolve => { release = resolve; });
  const api = createApi({ baseUrl: 'http://test/api', getSession: () => saved, setSession: value => { saved = value; }, fetcher: async url => {
    if (url.endsWith('/refresh')) { saved = null; await pending; return response(200, session('new')); }
    return response(401, { message: 'expired' });
  } });
  const result = api.get('/me'); release();
  await assert.rejects(result, /sesión cambió/); assert.equal(saved, null);
});
