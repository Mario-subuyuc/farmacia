import { readFile } from 'node:fs/promises';
import { databaseClient, databaseFailure } from './database.js';

let client;
try {
  client = await databaseClient();
  const sql = await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8');
  await client.query(sql);
  console.log('Seeder completado: sucursales, empleados, medicamentos, lotes, cliente, caja y activos DEMO.');
  console.log('No se crean cuentas Auth. Registra una cuenta y asigna su perfil según el README.');
} catch (error) {
  console.error('No se pudo ejecutar el seeder:', databaseFailure(error));
  process.exitCode = 1;
} finally {
  if (client) await client.end();
}
