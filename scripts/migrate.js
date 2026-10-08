import { readFile } from 'node:fs/promises';
import { databaseClient, databaseFailure } from './database.js';

let client;
try {
  client = await databaseClient();
  // Guardamos las migraciones ejecutadas, como la tabla migrations de Laravel.
  await client.query('select pg_advisory_lock(7062027)');
  await client.query('create schema if not exists privado');
  await client.query('revoke all on schema privado from public');
  await client.query('create table if not exists privado.migraciones (nombre text primary key, fecha timestamptz default now())');
  for (const name of ['001_schema.sql', '002_operations.sql']) {
    const result = await client.query('select nombre from privado.migraciones where nombre=$1', [name]);
    if (result.rowCount) { console.log(`Ya aplicada: ${name}`); continue; }
    const sql = await readFile(new URL(`../database/${name}`, import.meta.url), 'utf8');
    // Los archivos ya incluyen BEGIN/COMMIT. El registro se escribe en el mismo COMMIT.
    await client.query(sql.replace(/commit;\s*$/i, "insert into privado.migraciones(nombre) values ('" + name + "');\ncommit;"));
    console.log(`Aplicada: ${name}`);
  }
} catch (error) {
  console.error('No se pudo migrar:', databaseFailure(error));
  process.exitCode = 1;
} finally {
  if (client) await client.end();
}
