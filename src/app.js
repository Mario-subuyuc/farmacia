import express from 'express';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes.js';

const app = express();

// Convierte el JSON de la petición en req.body (máximo 16 KB).
app.use(express.json({ limit: '16kb' }));
// Muestra en la terminal las peticiones que recibe el servidor.
app.use(morgan('dev'));

// Todas las rutas de authRoutes empiezan con /api.
app.use('/api', authRoutes);

export default app;
