import { Router } from 'express';

import { login, register } from '../controllers/auth.controller.js';

const router = Router();

// Una ruta conecta un método y una URL con una función del controlador.
router.post('/login', login);
router.post('/register', register);

export default router;
