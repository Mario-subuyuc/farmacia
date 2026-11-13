import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { databaseClient, databaseFailure } from './database.js';
import { createAuthAdminClient } from '../src/config/database.js';
import Account from '../src/models/account.model.js';

const roles = { GERENTE: 'gerente', VENDEDOR: 'vendedor', BODEGA: 'bodega', CAJERO: 'cajero', CALL_CENTER: 'callcenter', AUDITOR: 'auditor' };
const branchCodes = ['GUA01', 'MIX01', 'XELA01', 'PET01', 'JUT01'];
const obsolete = ['99d57d8e-7c2e-4ab1-8483-7f67271aeccb', '38130a26-2e61-4aa1-bd05-7e41a02a9e0b'];
const administrator = 'mariosubuyucfb@gmail.com';
let db;
try {
  const password = process.env.BRANCH_INITIAL_PASSWORD;
  if (!password || password.length < 8) throw Error('Configura BRANCH_INITIAL_PASSWORD con al menos ocho caracteres.');
  const backup = process.argv.find(arg => arg.startsWith('--backup='))?.slice(9);
  if (!backup) throw Error('Indica el respaldo previo con --backup=archivo.dump.');
  const dump = await readFile(backup);
  if (dump.subarray(0,5).toString() !== 'PGDMP') throw Error('El respaldo no es un archivo PostgreSQL custom.');
  db = await databaseClient();
  await db.query('select pg_advisory_lock(7062030)');
  const admin = (await db.query("select u.id from auth.users u join perfiles p on p.id_usuario=u.id where lower(u.email)=$1 and p.rol='ADMIN' and p.activo", [administrator])).rows[0];
  if (!admin || obsolete.includes(admin.id)) throw Error('No se pudo verificar el administrador que debe conservarse.');
  const branches = (await db.query('select id_sucursal,codigo,nombre from sucursales order by id_sucursal')).rows;
  if (branches.length !== 5 || !branchCodes.every(code => branches.some(branch => branch.codigo === code))) throw Error('Las cinco sucursales no coinciden con la configuración acordada.');
  const client = createAuthAdminClient();
  const plan = branches.flatMap(branch => Object.entries(roles).map(([rol,prefix]) => {
    const username = `${prefix}-${branch.codigo.toLowerCase()}`;
    return { username, email: `${username}@example.com`, password, rol, id_sucursal: Number(branch.id_sucursal), sucursal: branch.nombre };
  }));
  await mkdir('backups', { recursive:true });
  const credentials = 'backups/usuarios-sucursales-2026-11-13.csv';
  const csv = value => '"' + String(value).replaceAll('"','""') + '"';
  await writeFile(credentials, '\uFEFF' + ['Usuario,Correo,Contrasena,Rol,Sucursal', ...plan.map(row => [row.username,row.email,row.password,row.rol,row.sucursal].map(csv).join(','))].join('\r\n'));
  let created = 0;
  for (const row of plan) {
    const existing = (await db.query('select u.id,u.raw_user_meta_data,p.rol,p.id_sucursal from auth.users u left join perfiles p on p.id_usuario=u.id where lower(u.email)=$1', [row.email])).rows[0];
    if (existing) {
      if (existing.raw_user_meta_data?.username !== row.username || existing.rol !== row.rol || Number(existing.id_sucursal) !== row.id_sucursal) throw Error('Una dirección planificada ya está vinculada a otra configuración.');
      continue;
    }
    await Account.create(client, { ...row, activo: true }, client);
    created++;
  }
  const verified = (await db.query('select count(*)::int n from auth.users u join perfiles p on p.id_usuario=u.id join permisos_operativos o using(id_usuario) where u.email=any($1::text[]) and p.activo', [plan.map(row => row.email)])).rows[0].n;
  if (verified !== 30) throw Error('No se verificaron las treinta cuentas; se conservan las cuentas anteriores.');
  for (const id of obsolete) {
    const user = (await db.query('select id,email from auth.users where id=$1',[id])).rows[0];
    if (!user) continue;
    if (user.email.toLowerCase() === administrator) throw Error('Se bloqueó la eliminación del administrador.');
    const profile = (await db.query('select * from perfiles where id_usuario=$1',[id])).rows[0];
    const permissions = (await db.query('select * from permisos_operativos where id_usuario=$1',[id])).rows[0];
    await writeFile(`backups/cuenta-retirada-${id}.json`, JSON.stringify({ user, profile, permissions },null,2));
    await db.query('delete from perfiles where id_usuario=$1',[id]);
    const result = await client.auth.admin.deleteUser(id);
    if (result.error) {
      if (profile) {
        await db.query('insert into perfiles(id_usuario,rol,id_sucursal,activo) values($1,$2,$3,$4)',[id,profile.rol,profile.id_sucursal,profile.activo]);
        if (permissions) await db.query('update permisos_operativos set aprobar_receta=$2,confirmar_pago=$3,aprobar_stock=$4,modificar_precio=$5 where id_usuario=$1',[id,permissions.aprobar_receta,permissions.confirmar_pago,permissions.aprobar_stock,permissions.modificar_precio]);
      }
      throw Error('No se pudo eliminar una cuenta anterior; se restauró su perfil.');
    }
  }
  const summary = (await db.query('select p.rol,count(*)::int cantidad from perfiles p group by p.rol order by p.rol')).rows;
  const total = (await db.query('select count(*)::int n from auth.users')).rows[0].n;
  if (total !== 31) throw Error('El total final no coincide con las 31 cuentas esperadas.');
  console.log(JSON.stringify({ created, total, roles: summary, credentials }));
} catch(error) {
  console.error(error.code && /^[0-9A-Z]{5}$/.test(error.code) ? databaseFailure(error) : (error.status ? 'No se completó la creación mediante Authentication. Revisa las cuentas creadas antes de reintentar.' : error.message));
  process.exitCode=1;
} finally { await db?.end(); }
