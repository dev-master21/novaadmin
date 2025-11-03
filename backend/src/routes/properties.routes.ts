// backend/src/routes/properties.routes.ts
import { Router } from 'express';
import propertiesController from '../controllers/properties.controller';
import { authenticate } from '../middlewares/auth.middleware';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';

const router = Router();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: async (_req, file, cb) => {
    let uploadPath = '';
    
    if (file.fieldname === 'photos') {
      uploadPath = path.join(process.cwd(), '../../../novaestate.company/backend/uploads/properties/photos');
    } else if (file.fieldname === 'floorPlan') {
      uploadPath = path.join(process.cwd(), '../../../novaestate.company/backend/uploads/properties/floor-plans');
    } else if (['front', 'back', 'left', 'right', 'top', 'bottom'].includes(file.fieldname)) {
      uploadPath = path.join(process.cwd(), '../../../novaestate.company/backend/uploads/properties/vr');
    } else if (file.fieldname === 'video') {
      uploadPath = path.join(process.cwd(), '../../../novaestate.company/backend/uploads/properties/videos');
    } else {
      uploadPath = path.join(process.cwd(), '../../../novaestate.company/backend/uploads/properties');
    }

    await fs.ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'video') {
      // Для видео разрешаем video форматы
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Только видео файлы разрешены'));
      }
    } else {
      // Для остальных - только изображения
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Только изображения разрешены'));
      }
    }
  }
});

// Основные CRUD операции
router.get('/', authenticate, propertiesController.getAll.bind(propertiesController));
router.get('/:id', authenticate, propertiesController.getById.bind(propertiesController));
router.post('/', authenticate, propertiesController.create.bind(propertiesController));
router.put('/:id', authenticate, propertiesController.update.bind(propertiesController));
router.delete('/:id', authenticate, propertiesController.delete.bind(propertiesController));

// Дополнительные операции
router.post('/:id/restore', authenticate, propertiesController.restore.bind(propertiesController));
router.patch('/:id/visibility', authenticate, propertiesController.toggleVisibility.bind(propertiesController));

// Фотографии
router.post('/:id/photos', authenticate, upload.array('photos', 50), propertiesController.uploadPhotos.bind(propertiesController));
router.delete('/photos/:photoId', authenticate, propertiesController.deletePhoto.bind(propertiesController));
router.put('/:id/photos/reorder', authenticate, propertiesController.updatePhotosOrder.bind(propertiesController));
router.patch('/photos/:photoId/primary', authenticate, propertiesController.setPrimaryPhoto.bind(propertiesController));

// Планировка
router.post('/:id/floor-plan', authenticate, upload.single('floorPlan'), propertiesController.uploadFloorPlan.bind(propertiesController));

// VR панорамы
router.get('/:id/vr-panoramas', authenticate, propertiesController.getVRPanoramas.bind(propertiesController));
router.post('/:id/vr-panoramas', authenticate, upload.fields([
  { name: 'front', maxCount: 1 },
  { name: 'back', maxCount: 1 },
  { name: 'left', maxCount: 1 },
  { name: 'right', maxCount: 1 },
  { name: 'top', maxCount: 1 },
  { name: 'bottom', maxCount: 1 }
]), propertiesController.createVRPanorama.bind(propertiesController));
router.delete('/vr-panoramas/:panoramaId', authenticate, propertiesController.deleteVRPanorama.bind(propertiesController));

// Видео
router.post('/:id/video', authenticate, upload.single('video'), propertiesController.uploadVideo.bind(propertiesController));
router.delete('/:id/video', authenticate, propertiesController.deleteVideo.bind(propertiesController));

// Цены и календарь
router.get('/:id/pricing-details', authenticate, propertiesController.getPricingDetails.bind(propertiesController));
router.get('/:id/calendar', authenticate, propertiesController.getCalendar.bind(propertiesController));

export default router;