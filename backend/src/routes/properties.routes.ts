// backend/src/routes/properties.routes.ts
import { Router } from 'express';
import propertiesController from '../controllers/properties.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { 
  uploadPropertyPhotos, 
  uploadFloorPlan, 
  uploadVRPanorama,
  uploadVideo 
} from '../config/upload.config';

const router = Router();

// Основные CRUD операции
router.get('/', authenticate, propertiesController.getAll.bind(propertiesController));
router.get('/:id', authenticate, propertiesController.getById.bind(propertiesController));
router.post('/', authenticate, propertiesController.create.bind(propertiesController));
router.put('/:id', authenticate, propertiesController.update.bind(propertiesController));
router.delete('/:id', authenticate, propertiesController.delete.bind(propertiesController));

// Получить уникальных владельцев (источников)
router.get('/owners/unique', authenticate, propertiesController.getUniqueOwners.bind(propertiesController));

// Скачать фотографии
router.post('/:id/photos/download', authenticate, propertiesController.downloadPhotos.bind(propertiesController));

// Дополнительные операции
router.post('/:id/restore', authenticate, propertiesController.restore.bind(propertiesController));
router.patch('/:id/visibility', authenticate, propertiesController.toggleVisibility.bind(propertiesController));

// Фотографии
router.post(
  '/:id/photos', 
  authenticate, 
  uploadPropertyPhotos.array('photos', 50), 
  propertiesController.uploadPhotos.bind(propertiesController)
);
router.delete(
  '/photos/:photoId', 
  authenticate, 
  propertiesController.deletePhoto.bind(propertiesController)
);
router.put(
  '/:id/photos/reorder', 
  authenticate, 
  propertiesController.updatePhotosOrder.bind(propertiesController)
);
router.patch(
  '/photos/:photoId/primary', 
  authenticate, 
  propertiesController.setPrimaryPhoto.bind(propertiesController)
);

// Планировка
router.post(
  '/:id/floor-plan', 
  authenticate, 
  uploadFloorPlan.single('floorPlan'), 
  propertiesController.uploadFloorPlan.bind(propertiesController)
);

// VR панорамы
router.get(
  '/:id/vr-panoramas', 
  authenticate, 
  propertiesController.getVRPanoramas.bind(propertiesController)
);
router.post(
  '/:id/vr-panoramas', 
  authenticate, 
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
  '/vr-panoramas/:panoramaId', 
  authenticate, 
  propertiesController.deleteVRPanorama.bind(propertiesController)
);

// Видео
router.post(
  '/:id/videos',
  authenticate,
  uploadVideo.array('videos', 10), // Максимум 10 видео за раз
  propertiesController.uploadVideos.bind(propertiesController)
);
router.delete(
  '/:id/videos/:videoId',
  authenticate,
  propertiesController.deleteVideo.bind(propertiesController)
);
router.put(
  '/:id/videos/:videoId',
  authenticate,
  propertiesController.updateVideo.bind(propertiesController)
);

// Цены и календарь
router.get(
  '/:id/pricing-details', 
  authenticate, 
  propertiesController.getPricingDetails.bind(propertiesController)
);
router.get(
  '/:id/calendar', 
  authenticate, 
  propertiesController.getCalendar.bind(propertiesController)
);

export default router;