import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeConfirmation } from '../src/utils/auth-confirmation.js';

test('confirmación elimina tokens de la URL y pide login sin confiar en ellos', () => {
  let target;
  const message = consumeConfirmation({ hash: '#access_token=secreto&refresh_token=otro&type=signup', pathname: '/', search: '' },
    { replaceState: (_, __, url) => { target = url; } });
  assert.equal(target, '/#inicio');
  assert.match(message, /Correo confirmado/);
  assert.ok(!message.includes('secreto'));
});
test('enlace inválido se limpia y navegación normal se conserva', () => {
  let changes = 0;
  const history = { replaceState: () => { changes++; } };
  assert.match(consumeConfirmation({ hash: '#error=access_denied&error_code=otp_expired', pathname: '/', search: '' }, history), /venció/);
  assert.equal(consumeConfirmation({ hash: '#inventario' }, history), '');
  assert.equal(changes, 1);
});
