// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';

const router = Router();

// Логин
router.post(
  '/login',
  validateRequest({
    required: ['username', 'password']
  }),
  authController.login
);

// Логаут
router.post('/logout', authenticate, authController.logout);

// Обновление токена
router.post(
  '/refresh',
  validateRequest({
    required: ['refreshToken']
  }),
  authController.refresh
);

// Получить текущего пользователя
router.get('/me', authenticate, authController.getCurrentUser);

export default router;