import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { databaseClient, databaseFailure } from './database.js';

// Mantenimiento manual: nunca ejecutar desde las migraciones ni el arranque.
export const operationalTables = [
  'public.activos', 'public.alertas_inventario', 'public.cierres_caja',
  'public.clientes', 'public.compras', 'public.cupones', 'public.detalle_compra',
  'public.detalle_pedido', 'public.detalle_planilla', 'public.detalle_traslado',
  'public.detalle_venta', 'public.devoluciones_clientes', 'public.empleados',
  'public.eventos', 'public.inscripciones', 'public.inventario', 'public.medicamentos',
  'public.movimientos_caja', 'public.movimientos_medicamentos', 'public.notificaciones',
  'public.pedidos', 'public.planillas', 'public.proveedores', 'public.reservas_pedido',
  'public.solicitudes_stock', 'public.stock_minimos', 'public.traslados', 'public.ventas',
  'privado.correos_eventos', 'privado.operaciones_farmacia', 'privado.pedidos_portal',
  'privado.solicitudes',
];
const protectedTables = [
  'auth.users', 'auth.identities', 'public.perfiles', 'public.permisos_operativos',
  'public.sucursales', 'public.plantillas_correo', 'public.contenidos',
  'public.auditoria', 'privado.migraciones',
];
const identifier = table => table.split('.').map(part => `"${part}"`).join('.');
async function snapshot(db, tables) {
  const result = {};
  for (const table of tables) {
    // Solo se guarda el hash de las tablas protegidas; nunca sus credenciales.
    const rows = (await db.query(`select to_jsonb(t)::text row from ${identifier(table)} t order by to_jsonb(t)::text`)).rows;
    result[table] = { count: rows.length, hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  }
  return result;
}

let db;
try {
  const backup = process.argv.find(arg => arg.startsWith('--backup='))?.slice(9);
  if (!backup) throw Error('Indica --backup=backups/archivo.dump para verificar el respaldo.');
  const manifest = JSON.parse(await readFile(backup + '.manifest.json', 'utf8'));
  const hash = createHash('sha256').update(await readFile(backup)).digest('hex');
  if (hash !== manifest.sha256) throw Error('El respaldo no coincide con su SHA-256.');
  if (!['public', 'privado', 'auth', 'storage'].every(schema => manifest.schemas.includes(schema))) throw Error('El respaldo no incluye los esquemas necesarios.');
  db = await databaseClient();
  await db.query('begin');
  await db.query("set local lock_timeout='15s'");
  await db.query('select pg_advisory_xact_lock(7062099)');
  await db.query(`lock table ${operationalTables.map(identifier).join(',')} in access exclusive mode`);
  await db.query(`lock table ${protectedTables.map(identifier).join(',')} in share mode`);
  const before = await snapshot(db, operationalTables);
  const protectedBefore = await snapshot(db, protectedTables);
  if (!process.argv.includes('--apply')) {
    await db.query('rollback');
    console.log(JSON.stringify({ mode: 'diagnostico', operational: before, preserved: protectedBefore }, null, 2));
  } else {
    // Sin CASCADE: una relación no contemplada debe detener la limpieza.
    // Conserva las secuencias para evitar reutilizar IDs presentes en auditoría.
    await db.query(`truncate table ${operationalTables.map(identifier).join(',')} continue identity restrict`);
    const after = await snapshot(db, operationalTables);
    if (Object.values(after).some(table => table.count !== 0)) throw Error('Quedaron datos operativos; se cancela la limpieza.');
    const protectedAfter = await snapshot(db, protectedTables);
    if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfter)) throw Error('Cambió una tabla protegida; se cancela la limpieza.');
    const report = { date: new Date().toISOString(), backup: path.basename(backup), before, after, preserved: protectedAfter };
    await db.query("insert into public.auditoria(tabla,registro,accion,despues) values('mantenimiento','limpieza-operativa','LIMPIEZA',$1::jsonb)", [JSON.stringify({ backup: report.backup, tables: operationalTables, removedRows: Object.values(before).reduce((total, table) => total + table.count, 0), preserved: protectedTables })]);
    await mkdir('backups', { recursive: true });
    const reportFile = `backups/limpieza-${Date.now()}.json`;
    await writeFile(reportFile, JSON.stringify(report, null, 2));
    await db.query('commit');
    console.log(JSON.stringify({ clearedTables: operationalTables.length, removedRows: Object.values(before).reduce((total, table) => total + table.count, 0), preservedCounts: Object.fromEntries(Object.entries(protectedAfter).map(([key,value]) => [key,value.count])), report: reportFile }));
  }
} catch (error) {
  if (db) await db.query('rollback').catch(() => {});
  console.error(error.code ? databaseFailure(error) : error.message);
  process.exitCode = 1;
} finally {
  await db?.end();
}
