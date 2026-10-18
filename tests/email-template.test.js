import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEmail} from '../src/services/email-template.js';
import {sendEmail} from '../src/services/email.js';
test('correo HTML escapa contenido e identifica alertas; conserva respaldo de texto',async()=>{
 const html=renderEmail({subject:'NexoFarma · VENCIDO',text:'Lote <script>alert(1)</script> & unidades',event:'VENCIDO'});
 assert.ok(html.includes('REQUIERE ATENCIÓN'));assert.ok(html.includes('role="presentation"'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&amp;'));
 await sendEmail({to:'test@example.invalid',subject:'NexoFarma · STOCK_BAJO',text:'Prueba de reposición',event:'STOCK_BAJO'},{sendMail:async message=>{assert.equal(message.text,'Prueba de reposición');assert.ok(message.html.includes('ALERTA DE INVENTARIO'));return {accepted:['test@example.invalid'],rejected:[],messageId:'mock'};}});
});
