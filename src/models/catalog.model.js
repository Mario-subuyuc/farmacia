import { databaseError } from '../utils/http-error.js';

// Recibimos el cliente del usuario, por eso cada consulta respeta RLS.
export async function listRecords(supabase, resource, filters, page) {
  let query = supabase.from(resource.table).select('*', { count: 'exact' });
  for (const [field, value] of Object.entries(filters)) query = query.eq(field, value);
  const result = await query.order(resource.id).range(page.from, page.to);
  if (result.error) throw databaseError(result.error);
  return result;
}

export async function findRecord(supabase, resource, id) {
  const result = await supabase.from(resource.table).select('*').eq(resource.id, id).maybeSingle();
  if (result.error) throw databaseError(result.error);
  return result.data;
}

export async function createRecord(supabase, resource, data) {
  const result = await supabase.from(resource.table).insert(data).select('*').single();
  if (result.error) throw databaseError(result.error);
  return result.data;
}

export async function updateRecord(supabase, resource, id, data) {
  const result = await supabase.from(resource.table).update(data).eq(resource.id, id).select('*').maybeSingle();
  if (result.error) throw databaseError(result.error);
  return result.data;
}
