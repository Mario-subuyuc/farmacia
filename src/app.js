import express from 'express';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes.js';
import { businessRoutes } from './routes/business.routes.js';
import { securityHeaders, authRateLimit } from './middlewares/security.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';

export function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  // Convierte JSON en req.body; admite pedidos de hasta 50 productos.
  app.use(express.json({ limit: '64kb' }));
  if (options.logger !== false) app.use(morgan('dev'));
  app.get('/api/health', function (req, res) { res.json({ status: 'ok' }); });
  app.use(['/api/login', '/api/register', '/api/refresh'], authRateLimit());
  app.use('/api', authRoutes);
  app.use('/api', businessRoutes(options.authenticate));
  app.use(function (req, res) { res.status(404).json({ message: 'Ruta no encontrada.' }); });
  app.use(errorHandler);
  return app;
}

export default createApp();
