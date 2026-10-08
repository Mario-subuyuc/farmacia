export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  if (error.type === 'entity.parse.failed') { status = 400; message = 'El JSON enviado está mal formado.'; }
  if (error.type === 'entity.too.large') { status = 413; message = 'El cuerpo de la petición es demasiado grande.'; }
  if (status >= 500) {
    console.error('Error del backend:', error.code || error.name);
    message = status === 503 ? 'Servicio temporalmente no disponible.' : 'Error interno del servidor.';
  }
  res.status(status).json({ message });
}
