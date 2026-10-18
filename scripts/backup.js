import 'dotenv/config';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const run=(command,args,env)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{env,stdio:'ignore',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('La herramienta de PostgreSQL no completó la operación. Revisa versión, conexión y permisos.')));});
try{
 if(!process.env.DATABASE_URL)throw Error('Configura DATABASE_URL.');
 const connection=new URL(process.env.DATABASE_URL);
 const env={...process.env,PGHOST:connection.hostname,PGPORT:connection.port||'5432',PGUSER:decodeURIComponent(connection.username),PGPASSWORD:decodeURIComponent(connection.password),PGDATABASE:connection.pathname.slice(1)};
 for(const [key,value] of connection.searchParams)if(['sslmode','sslrootcert','sslcert','sslkey'].includes(key))env['PG'+key.toUpperCase()]=value;
 await run('pg_dump',['--version'],env);await run('pg_restore',['--version'],env);
 if(process.argv.includes('--check')){console.log('pg_dump disponible. No se creó una copia.');}
 else{await mkdir('backups',{recursive:true});const target=path.resolve('backups','nexofarma-'+new Date().toISOString().replace(/[:.]/g,'-')+'.dump');await run('pg_dump',['--format=custom','--no-owner','--no-acl','--schema=public','--schema=privado','--file='+target],env);await run('pg_restore',['--list',target],env);console.log('Copia creada y catálogo verificado en:',target);}
}catch(error){console.error(error.code==='ENOENT'?'Instala las herramientas de PostgreSQL (pg_dump y pg_restore) compatibles con tu servidor.':error.message);process.exitCode=1;}
