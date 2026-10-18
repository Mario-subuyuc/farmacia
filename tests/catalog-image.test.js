import test from 'node:test';
import assert from 'node:assert/strict';
import { imageExtension } from '../src/controllers/catalog-image.controller.js';
test('imágenes: rechaza tipos falsos y archivos vacíos', () => {
  assert.equal(imageExtension(Buffer.from([255,216,255,0]), 'image/jpeg'), 'jpg');
  assert.equal(imageExtension(Buffer.from([137,80,78,71,13,10,26,10]), 'image/png'), 'png');
  assert.equal(imageExtension(Buffer.from('RIFF0000WEBP'), 'image/webp'), 'webp');
  assert.throws(() => imageExtension(Buffer.from('<svg/>'), 'image/png'), { status: 400 });
  assert.throws(() => imageExtension(Buffer.alloc(0), 'image/jpeg'), { status: 400 });
});
