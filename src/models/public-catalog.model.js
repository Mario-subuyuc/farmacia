import { createSupabaseClient } from '../config/database.js';

// Cliente sin sesión: solo ejecuta la función pública que limita los datos.
const PublicCatalog = {
  events(filters) {return createSupabaseClient().rpc('eventos_publicos',filters);},
  content() { return createSupabaseClient().rpc('contenido_publico'); },
  list(filters) { return createSupabaseClient().rpc('catalogo_publico', filters); },
};
export default PublicCatalog;
