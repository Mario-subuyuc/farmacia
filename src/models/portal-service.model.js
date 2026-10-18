import { createAuthAdminClient } from '../config/database.js';
// Punto de composición para pruebas locales; nunca recibe configuración del cliente HTTP.
export default { adminClient:createAuthAdminClient };
