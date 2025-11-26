// backend/src/routes/users.routes.ts
import { Router } from 'express';
import usersController from '../controllers/users.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticate);

// Получить список пользователей
router.get('/', requirePermission('users.read'), usersController.getAll);

// Получить пользователя по ID
router.get('/:id', requirePermission('users.read'), usersController.getById);

// Создать пользователя
router.post(
  '/',
  requirePermission('users.create'),
  validateRequest({
    required: ['username', 'password', 'full_name'],
    minLength: { username: 3, password: 6 }
  }),
  usersController.create
);

// Обновить пользователя
router.put('/:id', requirePermission('users.update'), usersController.update);

// Удалить пользователя
router.delete('/:id', requirePermission('users.delete'), usersController.delete);

export default router;