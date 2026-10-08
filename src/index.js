import app from './app.js';
import { PORT } from './config/config.js';

// app configura Express; listen abre el puerto para recibir peticiones.
const server = app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});

server.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exitCode = 1;
});
