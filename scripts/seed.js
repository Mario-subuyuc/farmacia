import { readFile } from 'node:fs/promises';
import { databaseClient, databaseFailure } from './database.js';
import { seedAdministrator } from './seed-admin.js';

let client;
try {
  client = await databaseClient();
  const sql = await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8');
  await client.query(sql);
  console.log('Seeder completado: sucursales, empleados, medicamentos, lotes, cliente, caja y activos DEMO.');
  const admin = await seedAdministrator(client);
  if (admin.skipped) console.log('Administrador omitido: configura ADMIN_SEED_EMAIL en .env para incluirlo.');
  else console.log(admin.created ? 'Cuenta inicial creada y perfil ADMIN activo.' : 'Cuenta existente conservada y perfil ADMIN activo. La contraseña no se modificó.');
} catch (error) {
  console.error('No se pudo ejecutar el seeder:', databaseFailure(error));
  process.exitCode = 1;
} finally {
  if (client) await client.end();
}
