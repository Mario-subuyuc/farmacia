import { databaseClient, databaseFailure } from './database.js';

// Diagnóstico de solo lectura: no crea tablas ni modifica datos.
let client;
try {
  client = await databaseClient();
  console.log('Conexión PostgreSQL correcta.');
  const tables = ['sucursales', 'empleados', 'medicamentos', 'inventario', 'clientes', 'activos', 'pedidos', 'ventas', 'perfiles', 'movimientos_caja'];
  let missing = false;
  for (const table of tables) {
    const exists = await client.query('select to_regclass($1) as tabla', [`public.${table}`]);
    if (!exists.rows[0].tabla) {
      console.log(`${table}: no existe. Aplica las migraciones.`);
      missing = true;
      continue;
    }
    // El nombre procede exclusivamente de la lista fija anterior.
    const result = await client.query(`select count(*) as total from public.${table}`);
    console.log(`${table}: ${result.rows[0].total} registros.`);
  }
  if (missing) process.exitCode = 1;
  console.log('En Supabase Table Editor selecciona el esquema public y comprueba que estás en el mismo proyecto que DATABASE_URL.');
} catch (error) {
  console.error('No se pudo comprobar la base:', databaseFailure(error));
  process.exitCode = 1;
} finally {
  if (client) await client.end();
}
