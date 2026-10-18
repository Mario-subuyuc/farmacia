import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs';
import { createClient } from '@supabase/supabase-js';
import { databaseClient, databaseFailure } from './database.js';
import { mkdir, writeFile } from 'node:fs/promises';

// Ilustraciones propias de productos DEMO; conserva cualquier foto ya asignada.
const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
let db, browser;
try {
  db = await databaseClient();
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta la clave privada del backend para cargar ilustraciones.');
  const storage = createClient(process.env.SUPABASE_URL, key, {auth:{persistSession:false}}).storage.from('catalogo');
  const {rows} = await db.query("select id_medicamento,codigo,nombre,categoria,descripcion from medicamentos where codigo like 'DEMO-%' and imagen_url is null order by codigo");
  browser = await chromium.launch({headless:true, channel:'msedge'});
  const page = await browser.newPage({viewport:{width:800,height:500},deviceScaleFactor:1});
  await mkdir('artifacts/catalog-images',{recursive:true});
  for (let i=0;i<rows.length;i++) {
    const row=rows[i], color=['#166c68','#577eae','#9c6c38','#785a9c'][i%4];
    const name=escape(row.nombre), category=escape(row.categoria);
    let shape=`<path d="M220 125 L510 105 L560 140 L560 350 L270 375 L220 340Z" fill="#dce7e5"/><path d="M220 125 L510 105 L510 330 L220 350Z" fill="white"/><path d="M220 125 L510 105 L510 187 L220 207Z" fill="${color}"/><path d="M510 105 L560 140 L560 350 L510 330Z" fill="#c9d9d7"/><text x="245" y="168" fill="white" font-size="25">NEXO FARMA</text><text x="245" y="245" fill="${color}" font-size="20">${name.length>30?name.slice(0,27)+'…':name}</text><text x="245" y="280" fill="#667875" font-size="15">${category}</text><path d="M245 307h160" stroke="${color}" stroke-width="5"/>`;
    if (/ANTI|VITC/.test(row.codigo)) shape=`<rect x="323" y="80" width="154" height="65" rx="12" fill="${color}"/><rect x="300" y="135" width="200" height="245" rx="35" fill="#e4c6a5"/><rect x="300" y="197" width="200" height="130" fill="white"/><rect x="300" y="197" width="200" height="35" fill="${color}"/><text x="400" y="221" text-anchor="middle" fill="white" font-size="18">NEXO FARMA</text><text x="400" y="266" text-anchor="middle" fill="${color}" font-size="17">${row.codigo==='DEMO-VITC'?'Vitamina C':'Antiácido'}</text><text x="400" y="299" text-anchor="middle" fill="#667875" font-size="16">${row.codigo==='DEMO-VITC'?'30 tabletas':'Suspensión · 120 ml'}</text>`;
    if (/SUERO/.test(row.codigo)) shape=`<path d="M280 90h240l-12 290H292Z" fill="white" stroke="#d2dfda" stroke-width="3"/><path d="M280 110h240v85H280Z" fill="${color}"/><text x="400" y="160" text-anchor="middle" fill="white" font-size="23">NEXO FARMA</text><text x="400" y="250" text-anchor="middle" fill="${color}" font-size="30">Suero oral</text><text x="400" y="290" text-anchor="middle" fill="#667875" font-size="18">Sales de rehidratación</text>`;
    if (/CREMA/.test(row.codigo)) shape=`<path d="M285 90h230l-35 245H320Z" fill="white" stroke="#d2dfda" stroke-width="3"/><path d="M299 180h202l-12 85H311Z" fill="${color}"/><rect x="320" y="335" width="160" height="45" rx="7" fill="${color}"/><text x="400" y="215" text-anchor="middle" fill="white" font-size="20">Hidrocortisona</text><text x="400" y="248" text-anchor="middle" fill="white" font-size="16">Crema</text>`;
    if (/SALB/.test(row.codigo)) shape=`<rect x="350" y="85" width="105" height="180" rx="18" fill="#cbd8df"/><path d="M330 190h145v100h65v80H330Z" fill="${color}"/><rect x="350" y="230" width="100" height="55" rx="6" fill="white"/><text x="400" y="263" text-anchor="middle" fill="${color}" font-size="17">Salbutamol</text>`;
    await page.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="#f1f5ee"/><ellipse cx="400" cy="394" rx="195" ry="19" fill="#dbe5d8"/>${shape}<text x="400" y="457" text-anchor="middle" fill="#687b70" font-size="16" font-family="sans-serif">ILUSTRACIÓN · PRODUCTO DE DEMOSTRACIÓN</text></svg></body></html>`);
    const bytes=await page.screenshot();
    await writeFile(`artifacts/catalog-images/${row.codigo}.png`,bytes);
    const path=`demo/${row.codigo.toLowerCase()}-v1.png`;
    const {error}=await storage.upload(path,bytes,{contentType:'image/png',upsert:true});
    if(error) throw new Error('No se pudo subir '+row.codigo+' a Storage.');
    const url=storage.getPublicUrl(path).data.publicUrl;
    const response=await fetch(url);
    if(!response.ok) throw new Error('La imagen subida no es accesible.');
    await db.query('update medicamentos set imagen_url=$1 where id_medicamento=$2 and imagen_url is null',[url,row.id_medicamento]);
    console.log('Imagen disponible:',row.nombre);
  }
  console.log('Catálogo actualizado:',rows.length,'ilustraciones.');
} catch(error) {
  console.error(error.code?databaseFailure(error):error.message);
  process.exitCode=1;
} finally {
  await browser?.close();
  await db?.end();
}
