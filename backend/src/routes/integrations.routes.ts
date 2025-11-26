// backend/src/routes/integrations.routes.ts
import { Router } from 'express';
import integrationsController from '../controllers/integrations.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticate);

// Получить все интеграции
router.get(
  '/',
  requirePermission('integrations.view'),
  integrationsController.getIntegrations.bind(integrationsController)
);

// Получить конкретную интеграцию
router.get(
  '/:type',
  requirePermission('integrations.view'),
  integrationsController.getIntegration.bind(integrationsController)
);

// Сохранить/обновить интеграцию
router.post(
  '/:type',
  requirePermission('integrations.manage'),
  integrationsController.saveIntegration.bind(integrationsController)
);

// Удалить интеграцию
router.delete(
  '/:type',
  requirePermission('integrations.manage'),
  integrationsController.deleteIntegration.bind(integrationsController)
);

// ========== BEDS24 СПЕЦИФИЧНЫЕ РОУТЫ ==========

// Проверить API ключ Beds24
router.post(
  '/beds24/verify',
  requirePermission('integrations.manage'),
  integrationsController.verifyBeds24.bind(integrationsController)
);

// Получить список объектов из Beds24
router.get(
  '/beds24/properties',
  requirePermission('integrations.view'),
  integrationsController.getBeds24Properties.bind(integrationsController)
);

// Получить список своих объектов для синхронизации
router.get(
  '/beds24/my-properties',
  requirePermission('integrations.view'),
  integrationsController.getMyProperties.bind(integrationsController)
);

// Привязать объект к Beds24
router.post(
  '/beds24/link',
  requirePermission('integrations.manage'),
  integrationsController.linkBeds24Property.bind(integrationsController)
);

// Отвязать объект от Beds24
router.delete(
  '/beds24/unlink/:propertyId',
  requirePermission('integrations.manage'),
  integrationsController.unlinkBeds24Property.bind(integrationsController)
);

export default router;