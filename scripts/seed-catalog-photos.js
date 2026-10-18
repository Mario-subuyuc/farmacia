import {createClient} from '@supabase/supabase-js';
import {databaseClient,databaseFailure} from './database.js';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const files={AMOX:'Amoxicillin 500mg capsules on a plate (Sandoz).jpg',ANTI:'Maalox (in Greece).jpg',CETI:'Cetirizin.jpg',CREMA:'Tube of hydrocortisone cream.jpg',IBU:'Ibuprofen 400.jpg',LORA:'Comprimidos de Loratadina.jpg',LOSA:'Losartan potassium1.jpg',OME:'Omeprazole 20mg.jpg',PARA:'Парацетамол, Фармстандарт Курск (Paracetamol) 01.jpg',SALB:'Ventolin Inhaler N 100 ug inh.jpg',SUERO:'Sales de rehidratación oral.jpg',VITC:'Vitamin C pill.jpg'};
const strip=s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let db;
try{
 db=await databaseClient();
 const storage=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}).storage.from('catalogo');
 const credits=JSON.parse(await readFile('frontend/public/catalog-photo-credits.json','utf8').catch(()=>'[]'));
 await mkdir('frontend/public',{recursive:true});
 for(const [code,title] of Object.entries(files)){
  if(credits.some(c=>c.code===code))continue;
  const source='https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(title.replaceAll(' ','_'));
  const html=await fetch(source).then(r=>r.text());
  const match=html.match(/class="fullImageLink"[^>]*><a href="([^"]+)"/);
  if(!match)throw new Error('No se encontró la fotografía: '+code);
  const thumbnail=html.match(/class="fullImageLink"[\s\S]*?<img[^>]+src="([^"]+)"/);
  const original=(thumbnail?.[1] || match[1]).replaceAll('&amp;','&');
  const section=html.slice(html.indexOf('id="Licensing"'),html.indexOf('id="filehistory"'));
  const license=[...new Set([...section.matchAll(/https?:\/\/creativecommons.org\/(?:licenses|publicdomain)\/[a-z0-9/.-]+/g)].map(m=>m[0]))];
  if(!license.length && !/public domain/i.test(section))throw new Error('Revisar licencia: '+code);
  const author=strip(html.match(/id="fileinfotpl(?:&#95;|_)aut"[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)?.[1]||'Ver autor en la página original');
  let response;
  for(let attempt=0;attempt<4;attempt++){
   response=await fetch(original.split('?')[0] + '?download=1&attempt=' + attempt);
   if(response.ok)break;
   console.log('Reintentando descarga',code,response.status);
   await new Promise(r=>setTimeout(r,5000));
  }
  if(!response.ok)throw new Error('No se pudo descargar '+code);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>5242880)throw new Error('Fotografía supera 5 MB: '+code);
  const path='demo/photos/'+code.toLowerCase()+'-v1.jpg';
  const {error}=await storage.upload(path,bytes,{contentType:'image/jpeg',upsert:true});
  if(error)throw new Error('Fallo al subir '+code);
  const url=storage.getPublicUrl(path).data.publicUrl;
  if(!(await fetch(url)).ok)throw new Error('Foto no accesible: '+code);
  await db.query("update medicamentos set imagen_url=$1 where codigo=$2 and (imagen_url is null or imagen_url like '%/demo/%')",[url,'DEMO-'+code]);
  credits.push({code,title,source,author,license});
  await writeFile('frontend/public/catalog-photo-credits.json',JSON.stringify(credits,null,2));
  await writeFile('frontend/public/catalog-photo-credits.html',`<!doctype html><html lang="es"><meta charset="utf-8"><title>Créditos de fotografías</title><body style="font:16px system-ui;max-width:900px;margin:40px auto;padding:20px"><h1>Fotografías del catálogo</h1><p>Fotografías de referencia. La marca, el envase o la presentación pueden variar. Fotograf?as alojadas en Supabase Storage; algunas se redujeron de tama?o sin otros cambios.</p>${credits.map(c=>`<article><h2>${esc(c.code)}</h2><p>${esc(c.title)} · Autor: ${esc(c.author)}</p><a href="${esc(c.source)}">Fuente y atribución completa</a> ${c.license.map(l=>`<a href="${esc(l)}">Licencia</a>`).join(' ')}</article>`).join('')}</body></html>`);
  console.log('Fotografía cargada:',code,bytes.length,'bytes');
 }
 console.log('Listo:',credits.length,'fotografías reales.');
}catch(error){console.error(error.code?databaseFailure(error):error.message);process.exitCode=1}finally{await db?.end()}
