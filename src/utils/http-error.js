// Un error conocido tiene mensaje para el cliente y un código HTTP.
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function databaseError(error) {
  if (error.code === '42501') return httpError(403, 'No tienes permiso para esta operación.');
  if (error.code === 'P0002' || error.code === 'PGRST116') return httpError(404, 'Registro no encontrado.');
  if (error.code === '23505') return httpError(409, 'El registro o pago ya existe.');
  if (error.code === 'P0001') return httpError(409, error.message);
  if (['22023', '22P02', '22007', '22008', '23502', '23503', '23514', '22003', '22001'].includes(error.code)) {
    return httpError(400, 'Datos inválidos, relación inexistente o valor fuera de los límites.');
  }
  // No mostramos consultas SQL, claves ni detalles internos al cliente.
  return httpError(503, 'No se pudo consultar la base de datos.');
}
