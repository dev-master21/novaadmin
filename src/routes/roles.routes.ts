// backend/src/routes/roles.routes.ts
import { Router } from 'express';
import rolesController from '../controllers/roles.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticate);

// Получить список ролей
router.get('/', requirePermission('roles.read'), rolesController.getAll);

// Получить все права доступа
router.get('/permissions/all', requirePermission('roles.read'), rolesController.getAllPermissions);

// Получить роль по ID
router.get('/:id', requirePermission('roles.read'), rolesController.getById);

// Создать роль
router.post(
  '/',
  requirePermission('roles.create'),
  validateRequest({
    required: ['role_name', 'permission_ids']
  }),
  rolesController.create
);

// Обновить роль
router.put('/:id', requirePermission('roles.update'), rolesController.update);

// Удалить роль
router.delete('/:id', requirePermission('roles.delete'), rolesController.delete);

export default router;