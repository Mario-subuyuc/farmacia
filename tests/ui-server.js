// Servidor exclusivo de tests E2E. No usar para desarrollo real ni despliegue.
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
process.env.CORS_ORIGINS = 'http://localhost:5174';
const { testDatabase, testSupabase, accounts } = await import('./database-helper.js');
const { createApp } = await import('../src/app.js');
const { createAuthenticate } = await import('../src/middlewares/auth.middleware.js');
const { default: User } = await import('../src/models/user.model.js');
const { default: PublicCatalog } = await import('../src/models/public-catalog.model.js');
const { default: PortalService }=await import('../src/models/portal-service.model.js');
const db = await testDatabase();
await db.exec('grant execute on function public.cotizar_pedido_portal(jsonb),public.crear_pedido_portal(jsonb,uuid,text),public.seguir_pedido_portal(text),public.cancelar_pedido_portal(text) to authenticated');
PublicCatalog.events=async args=>({data:(await db.query('select eventos_publicos($1,$2) data',[args.p_desde,args.p_hasta])).rows[0].data,error:null});
PublicCatalog.content=async()=>({data:(await db.query('select contenido_publico() as data')).rows[0].data,error:null});
PublicCatalog.list = async p => ({ data: (await db.query('select public.catalogo_publico($1,$2,$3,$4,$5) as data', [p.p_busqueda,p.p_sucursal,p.p_categoria,p.p_pagina,p.p_limite])).rows[0].data, error: null });
await db.exec("grant execute on function public.inscribir_evento(bigint,text,text,text,text,text),public.confirmar_inscripcion(text,boolean) to authenticated; create function public.test_event_mail(text) returns text language sql security definer as $$ select action_url from privado.correos_eventos where destino=$1 and evento='CONFIRMAR_INSCRIPCION' order by id desc limit 1 $$; grant execute on function public.test_event_mail(text) to authenticated;");
await db.exec('set role authenticated');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [accounts.admin]);
const client = testSupabase(db);
const files=new Map();
PortalService.adminClient=()=>({...client,storage:{from:()=>({upload:async(path,bytes)=>{files.set(path,bytes);return {error:null};},list:async(folder)=>({error:null,data:[...files.keys()].filter(key=>key.startsWith(folder+'/')).map(key=>({name:key.split('/')[1]}))}),getPublicUrl:path=>({data:{publicUrl:'data:image/png;base64,'+files.get(path)?.toString('base64')}}),remove:async paths=>{for(const path of paths)files.delete(path);return {error:null};},createSignedUrl:async(path)=>({data:{signedUrl:'data:image/png;base64,'+files.get(path)?.toString('base64')},error:null})})}});
const user = { id: accounts.admin, email: 'admin@example.com', user_metadata: { username: 'Administrador' } };
function session() { return { access_token: 'test-admin', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer' }; }
User.login = async function ({ email, password }) {
  if (email !== 'admin@example.com' || password !== 'test-password') return { error: { code: 'invalid_credentials', status: 400 } };
  return { data: { user, session: session() }, error: null };
};
User.refresh = async () => ({ data: { user, session: session() }, error: null });
const authenticate = createAuthenticate(token => ({ ...client,storage:PortalService.adminClient().storage, auth: { getUser: async () => token === 'test-admin'
  ? { data: { user }, error: null } : { data: { user: null }, error: { status: 401 } } } }));
const {default:express}=await import('express');
const app=express();
app.get('/__tests/event-mail',async(req,res)=>res.json({url:(await db.query('select test_event_mail($1) as url',[req.query.email])).rows[0].url}));
app.use(createApp({ authenticate, logger: false }));
const server = app.listen(3010, '127.0.0.1', () => console.log('API de tests local lista en puerto 3010.'));
async function close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); process.exit(0); }
process.on('SIGINT', close); process.on('SIGTERM', close);

