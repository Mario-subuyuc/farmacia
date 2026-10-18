import {enroll,confirmEnrollment} from './controllers/enrollment.controller.js';
import { publicEvents } from './controllers/events.controller.js';
import { createSupabaseClient } from './config/database.js';
import path from 'node:path';
import { publicContent, uploadPrescription, cancelPortalOrder } from './controllers/order-lifecycle.controller.js';
import express from 'express';
import morgan from 'morgan';

import { searchProducts } from './controllers/product-search.controller.js';
import { checkout, trackOrder, quoteOrder } from './controllers/portal-order.controller.js';
import authRoutes from './routes/auth.routes.js';
import { accountRoutes } from './routes/account.routes.js';
import { publicCatalog } from './controllers/public-catalog.controller.js';
import { businessRoutes } from './routes/business.routes.js';
import { securityHeaders, authRateLimit } from './middlewares/security.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';

export function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  // Convierte JSON en req.body; admite pedidos de hasta 50 productos.
  app.use(express.json({ limit: '64kb' }));
  if (options.logger !== false) app.use(morgan(process.env.NODE_ENV==='production'?'combined':'dev'));
  app.get('/api/health', function (req, res) { res.json({ status: 'ok' }); });
  app.get('/api/ready',async(req,res)=>{try{const result=await createSupabaseClient().rpc('catalogo_publico',{p_limite:1});res.status(result.error?503:200).json({status:result.error?'unavailable':'ready'});}catch{res.status(503).json({status:'unavailable'});}});
  app.get('/api/catalogo', publicCatalog);
  app.get('/api/eventos-publicos',publicEvents);
  app.post('/api/eventos/inscribirse',authRateLimit(10),enroll);
  app.post('/api/eventos/confirmar',authRateLimit(40),confirmEnrollment);
  app.get('/api/contenido', publicContent);
  app.post('/api/tienda/recetas', authRateLimit(), express.raw({type:['image/jpeg','image/png','image/webp'],limit:'5mb'}), uploadPrescription);
  app.post('/api/tienda/cancelar', authRateLimit(), cancelPortalOrder);
  app.post('/api/asistente/productos', authRateLimit(120), searchProducts);
  app.use('/api/tienda/pedidos', authRateLimit());
  app.use('/api/tienda/seguimiento', authRateLimit(120));
  app.post('/api/tienda/pedidos', checkout);
  app.post('/api/tienda/cotizar', authRateLimit(60), quoteOrder);
  app.post('/api/tienda/seguimiento', trackOrder);
  app.post('/api/register', function (req, res) { res.status(410).json({ message: 'Registro público deshabilitado. Solicita una cuenta al administrador.' }); });
  app.use(['/api/login', '/api/refresh'], authRateLimit());
  app.use('/api', authRoutes);
  app.use('/api', accountRoutes(options.authenticate));
  app.use('/api', businessRoutes(options.authenticate));
  if(process.env.SERVE_FRONTEND==='true'){app.use(express.static(path.resolve('frontend/dist')));app.get('/',(req,res)=>res.sendFile(path.resolve('frontend/dist/index.html')));}
  app.use(function (req, res) { res.status(404).json({ message: 'Ruta no encontrada.' }); });
  app.use(errorHandler);
  return app;
}

export default createApp();
