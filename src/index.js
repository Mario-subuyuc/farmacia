import app from './app.js';
import { PORT } from './config/config.js';

const server = app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});

server.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exitCode = 1;
});