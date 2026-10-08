import 'dotenv/config';
import pg from 'pg';

// Solo los comandos de mantenimiento usan DATABASE_URL. La API usa Supabase + RLS.
export async function databaseClient() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('Falta DATABASE_URL en .env. Copia la conexión PostgreSQL desde Connect de Supabase y completa la contraseña de la base de datos.');
    error.code = 'DATABASE_URL_MISSING';
    throw error;
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  return client;
}

// Mensajes útiles sin imprimir la URL, la contraseña ni el error completo de pg.
export function databaseFailure(error) {
  const messages = {
    DATABASE_URL_MISSING: 'Falta DATABASE_URL en .env. SUPABASE_URL y la clave publicable conectan la API, pero no ejecutan migraciones. Copia la conexión PostgreSQL desde Connect de Supabase y completa la contraseña de la base de datos.',
    '28P01': 'La contraseña o el usuario PostgreSQL son incorrectos. Revisa DATABASE_URL.',
    ENOTFOUND: 'No se encontró el servidor PostgreSQL. Revisa el host en DATABASE_URL.',
    ENETUNREACH: 'El servidor no es accesible desde esta red. Prueba la conexión Session pooler de Supabase.',
    ECONNREFUSED: 'El servidor rechazó la conexión. Revisa el host y el puerto; localhost no conecta tu proyecto Supabase.',
    ETIMEDOUT: 'La conexión tardó demasiado. Revisa tu red y utiliza el Session pooler si no tienes acceso IPv6.',
    '42P07': 'Ya existe una tabla de la migración. Si instalaste el SQL manualmente, no vuelvas a crear el esquema con db:migrate; revisa las tablas existentes.',
    '42P01': 'Falta una tabla. Aplica las migraciones antes de ejecutar el seeder.',
    '42501': 'El usuario PostgreSQL no tiene permisos suficientes para esta tarea.',
  };
  return messages[error.code] || `No se completó la operación (${error.code || error.name}). Revisa la conexión, TLS y el estado de las migraciones. No se muestran credenciales.`;
}
