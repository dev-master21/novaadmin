// backend/src/routes/propertyOwners.routes.ts
import { Router } from 'express';
import propertyOwnersController from '../controllers/propertyOwners.controller';
import { authenticate, authenticateOwner, requirePricingEditPermission, requireCalendaryEditPermission } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';

const router = Router();

// ========== АДМИНСКИЕ ЭНДПОИНТЫ ==========
router.post(
  '/create',
  authenticate,
  validateRequest({
    required: ['owner_name']
  }),
  propertyOwnersController.createOwnerAccess.bind(propertyOwnersController)
);

router.get(
  '/info/:ownerName',
  authenticate,
  propertyOwnersController.getOwnerInfo.bind(propertyOwnersController)
);

router.put(
  '/permissions/:ownerName',
  authenticate,
  validateRequest({
    optional: ['can_edit_calendar', 'can_edit_pricing']
  }),
  propertyOwnersController.updateOwnerPermissions.bind(propertyOwnersController)
);

// ========== ПУБЛИЧНЫЕ ЭНДПОИНТЫ ==========
router.get(
  '/verify/:token',
  propertyOwnersController.verifyOwnerToken.bind(propertyOwnersController)
);

router.post(
  '/login',
  validateRequest({
    required: ['access_token', 'password']
  }),
  propertyOwnersController.login.bind(propertyOwnersController)
);

router.post(
  '/refresh',
  validateRequest({
    required: ['refreshToken']
  }),
  propertyOwnersController.refreshToken.bind(propertyOwnersController)
);

// ========== ЭНДПОИНТЫ ДЛЯ АВТОРИЗОВАННЫХ ВЛАДЕЛЬЦЕВ ==========
router.use(authenticateOwner);

router.get(
  '/properties',
  propertyOwnersController.getOwnerProperties.bind(propertyOwnersController)
);

router.get(
  '/property/:id',
  propertyOwnersController.getOwnerProperty.bind(propertyOwnersController)
);

router.put(
  '/property/:id/pricing',
  requirePricingEditPermission,
  propertyOwnersController.updatePropertyPricing.bind(propertyOwnersController)
);

router.put(
  '/property/:id/monthly-pricing',
  requirePricingEditPermission,
  propertyOwnersController.updatePropertyMonthlyPricing.bind(propertyOwnersController)
);

router.get(
  '/property/:id/preview-url',
  propertyOwnersController.getPropertyPreviewUrl.bind(propertyOwnersController)
);

// ✅ НОВЫЕ РОУТЫ ДЛЯ КАЛЕНДАРЯ

// Получить календарь (просмотр - без проверки прав)
router.get(
  '/property/:id/calendar',
  propertyOwnersController.getPropertyCalendar.bind(propertyOwnersController)
);

// Добавить блокировку (требует прав на редактирование)
router.post(
  '/property/:id/calendar/block',
  requireCalendaryEditPermission,
  propertyOwnersController.addBlockedPeriod.bind(propertyOwnersController)
);

// Удалить блокировки (требует прав на редактирование)
router.delete(
  '/property/:id/calendar/block',
  requireCalendaryEditPermission,
  propertyOwnersController.removeBlockedDates.bind(propertyOwnersController)
);

// Получить ICS информацию (просмотр - без проверки прав)
router.get(
  '/property/:id/ics',
  propertyOwnersController.getICSInfo.bind(propertyOwnersController)
);

// Получить внешние календари (просмотр - без проверки прав)
router.get(
  '/property/:id/external-calendars',
  propertyOwnersController.getExternalCalendars.bind(propertyOwnersController)
);

// Добавить внешний календарь (требует прав на редактирование)
router.post(
  '/property/:id/external-calendars',
  requireCalendaryEditPermission,
  propertyOwnersController.addExternalCalendar.bind(propertyOwnersController)
);

// Удалить внешний календарь (требует прав на редактирование)
router.delete(
  '/property/:id/external-calendars/:calendarId',
  requireCalendaryEditPermission,
  propertyOwnersController.removeExternalCalendar.bind(propertyOwnersController)
);

// Переключить синхронизацию календаря (требует прав на редактирование)
router.patch(
  '/property/:id/external-calendars/:calendarId/toggle',
  requireCalendaryEditPermission,
  propertyOwnersController.toggleExternalCalendar.bind(propertyOwnersController)
);

// Анализировать конфликты (просмотр - без проверки прав)
router.post(
  '/property/:id/external-calendars/analyze',
  propertyOwnersController.analyzeExternalCalendars.bind(propertyOwnersController)
);

// Синхронизировать календари (требует прав на редактирование)
router.post(
  '/property/:id/external-calendars/sync',
  requireCalendaryEditPermission,
  propertyOwnersController.syncExternalCalendars.bind(propertyOwnersController)
);

// Смена пароля
router.post(
  '/change-password',
  validateRequest({
    required: ['current_password', 'new_password']
  }),
  propertyOwnersController.changePassword.bind(propertyOwnersController)
);

export default router;