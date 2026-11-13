import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEmail} from '../src/services/email-template.js';
import {sendEmail} from '../src/services/email.js';
import {emailPreview} from '../src/services/email-preview.js';

test('categorías muestran ejemplos distintos y respetan colores personalizados', () => {
 const previews=['GENERAL','ALERTA','PEDIDO','EVENTO'].map(tipo=>renderEmail(emailPreview({tipo,color_fondo:'#aabbcc',color_principal:'#112233'})));
 assert.equal(new Set(previews).size,4);
 assert.ok(previews[1].includes('Es momento de reponer inventario'));
 assert.ok(previews[2].includes('Tu pedido está confirmado'));
 assert.ok(previews[3].includes('Tu inscripción está confirmada'));
 for(const html of previews){assert.ok(html.includes('style="background:#aabbcc"'));assert.ok(html.includes('background:#112233'));assert.ok(!html.includes('#f0f4ee'));}
});
test('correo HTML escapa contenido e identifica alertas; conserva respaldo de texto',async()=>{
 const html=renderEmail({subject:'NexoFarma · VENCIDO',text:'Lote <script>alert(1)</script> & unidades',event:'VENCIDO'});
 assert.ok(html.includes('REQUIERE ATENCIÓN'));assert.ok(html.includes('role="presentation"'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&amp;'));
 await sendEmail({to:'test@example.invalid',subject:'NexoFarma · STOCK_BAJO',text:'Prueba de reposición',event:'STOCK_BAJO'},{sendMail:async message=>{assert.equal(message.text,'Prueba de reposición');assert.ok(message.html.includes('ALERTA DE INVENTARIO'));return {accepted:['test@example.invalid'],rejected:[],messageId:'mock'};}});
});
