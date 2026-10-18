import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { createAccount } from '../controllers/account.controller.js';

export function accountRoutes(authentication = authenticate) {
  const router = Router();
  router.post('/usuarios', authentication, authorize(['ADMIN']), createAccount);
  return router;
}
