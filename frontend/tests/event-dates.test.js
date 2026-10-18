import test from 'node:test';
import assert from 'node:assert/strict';
import {initialValues,formPayload} from '../src/utils/forms.js';
test('eventos convierten horario de Guatemala sin depender del huso del equipo',()=>{
 const fields=[{name:'inicio',type:'datetime-local'}];assert.equal(initialValues(fields,{inicio:'2026-10-20T16:00:00Z'}).inicio,'2026-10-20T10:00');assert.equal(formPayload(fields,{inicio:'2026-10-20T10:00'}).inicio,'2026-10-20T16:00:00.000Z');
});
