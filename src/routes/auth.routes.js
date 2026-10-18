import { Router } from 'express';

import { login, refresh } from '../controllers/auth.controller.js';

const router = Router();

// Una ruta conecta un método y una URL con una función del controlador.
router.post('/login', login);
router.post('/refresh', refresh);

export default router;
