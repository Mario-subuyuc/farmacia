import { databaseError } from '../utils/http-error.js';

export async function runOperation(supabase, action, data, key) {
  const result = await supabase.rpc('ejecutar_operacion', { p_accion: action, p_datos: data, p_clave: key });
  if (result.error) throw databaseError(result.error);
  return result.data;
}

export async function availability(supabase, data) {
  const result = await supabase.rpc('consultar_disponibilidad', { p_datos: data });
  if (result.error) throw databaseError(result.error);
  return result.data;
}

export async function companyReport(supabase, from, to, branch) {
  const result = await supabase.rpc('reporte_empresa', { p_desde: from, p_hasta: to, p_sucursal: branch });
  if (result.error) throw databaseError(result.error);
  return result.data;
}
