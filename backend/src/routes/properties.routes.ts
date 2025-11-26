// backend/src/routes/properties.routes.ts
import { Router } from 'express';
import propertiesController from '../controllers/properties.controller';
import { 
  authenticate, 
  requirePermission,
  canEditProperty,
  requireSuperAdmin
} from '../middlewares/auth.middleware';
import { 
  uploadPropertyPhotos, 
  uploadFloorPlan, 
  uploadVRPanorama,
  uploadVideo 
} from '../config/upload.config';

const router = Router();

// Основные CRUD операции
router.get('/', authenticate, requirePermission('properties.read'), propertiesController.getAll.bind(propertiesController));
router.get('/owners/unique', authenticate, requirePermission('properties.update'), propertiesController.getUniqueOwners.bind(propertiesController));
router.get('/:id', authenticate, requirePermission('properties.read'), propertiesController.getById.bind(propertiesController));
router.post('/', authenticate, requirePermission('properties.create'), propertiesController.create.bind(propertiesController));
router.put('/:id', authenticate, canEditProperty, propertiesController.update.bind(propertiesController));
router.get('/:id/prices', propertiesController.getPropertyPrices.bind(propertiesController));

// Удаление и изменение статуса
router.delete('/:id', authenticate, requireSuperAdmin, propertiesController.delete.bind(propertiesController));
router.post('/:id/restore', authenticate, requireSuperAdmin, propertiesController.restore.bind(propertiesController));
router.patch('/:id/visibility', authenticate, requireSuperAdmin, propertiesController.toggleVisibility.bind(propertiesController));

// Скачать фотографии
router.post('/:id/photos/download', authenticate, requirePermission('properties.read'), propertiesController.downloadPhotos.bind(propertiesController));

// Фотографии
router.post(
  '/:id/photos', 
  authenticate, 
  canEditProperty,
  uploadPropertyPhotos.array('photos', 200), 
  propertiesController.uploadPhotos.bind(propertiesController)
);
router.delete(
  '/:id/photos/:photoId',
  authenticate, 
  canEditProperty,
  propertiesController.deletePhoto.bind(propertiesController)
);
router.put(
  '/:id/photos/reorder', 
  authenticate, 
  canEditProperty,
  propertiesController.updatePhotosOrder.bind(propertiesController)
);
router.patch(
  '/:id/photos/:photoId/primary',
  authenticate, 
  canEditProperty,
  propertiesController.setPrimaryPhoto.bind(propertiesController)
);

// Планировка
router.post(
  '/:id/floor-plan', 
  authenticate, 
  canEditProperty,
  uploadFloorPlan.single('floorPlan'), 
  propertiesController.uploadFloorPlan.bind(propertiesController)
);

// VR панорамы
router.get(
  '/:id/vr-panoramas', 
  authenticate, 
  requirePermission('properties.read'),
  propertiesController.getVRPanoramas.bind(propertiesController)
);
router.post(
  '/:id/vr-panoramas', 
  authenticate, 
  canEditProperty,
  uploadVRPanorama.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
    { name: 'left', maxCount: 1 },
    { name: 'right', maxCount: 1 },
    { name: 'top', maxCount: 1 },
    { name: 'bottom', maxCount: 1 }
  ]), 
  propertiesController.createVRPanorama.bind(propertiesController)
);
router.delete(
  '/:id/vr-panoramas/:panoramaId',
  authenticate, 
  canEditProperty,
  propertiesController.deleteVRPanorama.bind(propertiesController)
);

// Видео
router.post(
  '/:id/videos',
  authenticate,
  canEditProperty,
  uploadVideo.array('videos', 10),
  propertiesController.uploadVideos.bind(propertiesController)
);
router.delete(
  '/:id/videos/:videoId',
  authenticate,
  canEditProperty,
  propertiesController.deleteVideo.bind(propertiesController)
);
router.put(
  '/:id/videos/:videoId',
  authenticate,
  canEditProperty,
  propertiesController.updateVideo.bind(propertiesController)
);

// Цены
router.get(
  '/:id/pricing-details', 
  authenticate, 
  requirePermission('properties.read'),
  propertiesController.getPricingDetails.bind(propertiesController)
);

router.put(
  '/:id/monthly-pricing',
  authenticate,
  canEditProperty,
  propertiesController.updateMonthlyPricing.bind(propertiesController)
);

// Календарь
router.get(
  '/:id/calendar', 
  authenticate, 
  requirePermission('properties.read'),
  propertiesController.getCalendar.bind(propertiesController)
);

router.post(
  '/:id/calendar/block',
  authenticate,
  canEditProperty,
  propertiesController.addBlockedPeriod.bind(propertiesController)
);

router.delete(
  '/:id/calendar/block',
  authenticate,
  canEditProperty,
  propertiesController.removeBlockedDates.bind(propertiesController)
);

router.get(
  '/:id/ics',
  authenticate,
  requirePermission('properties.read'),
  propertiesController.getICSInfo.bind(propertiesController)
);

// Внешние календари
router.post(
  '/:id/external-calendars/analyze',
  authenticate,
  requirePermission('properties.read'),
  propertiesController.analyzeExternalCalendars.bind(propertiesController)
);

router.post(
  '/:id/external-calendars/sync',
  authenticate,
  canEditProperty,
  propertiesController.syncExternalCalendars.bind(propertiesController)
);

router.get(
  '/:id/external-calendars',
  authenticate,
  requirePermission('properties.read'),
  propertiesController.getExternalCalendars.bind(propertiesController)
);

router.post(
  '/:id/external-calendars',
  authenticate,
  canEditProperty,
  propertiesController.addExternalCalendar.bind(propertiesController)
);

router.patch(
  '/:id/external-calendars/:calendarId/toggle',
  authenticate,
  canEditProperty,
  propertiesController.toggleExternalCalendar.bind(propertiesController)
);

router.delete(
  '/:id/external-calendars/:calendarId',
  authenticate,
  canEditProperty,
  propertiesController.removeExternalCalendar.bind(propertiesController)
);

// AI Generation routes
router.get(
  '/:id/ai-generation/readiness',
  authenticate,
  requirePermission('properties.read'),
  propertiesController.checkAIGenerationReadiness.bind(propertiesController)
);

router.post(
  '/:id/ai-generation/generate',
  authenticate,
  canEditProperty,
  propertiesController.generateAIDescription.bind(propertiesController)
);

// AI создание объекта
router.post('/create-with-ai', authenticate, requirePermission('properties.create'), propertiesController.createWithAI.bind(propertiesController));
router.post('/save-from-ai', authenticate, requirePermission('properties.create'), propertiesController.saveFromAI.bind(propertiesController));

router.get('/:id/prices', propertiesController.getPropertyPrices.bind(propertiesController));

// Генерация HTML презентации
router.post(
  '/:id/generate-html',
  authenticate,
  propertiesController.generateHTML.bind(propertiesController)
);

export default router;