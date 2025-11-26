// backend/src/config/upload.config.ts
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import logger from '../utils/logger';

// ПУТЬ К FRONTEND ПРОЕКТУ (относительно текущей админки)
const FRONTEND_UPLOADS_BASE = '/var/www/www-root/data/www/novaestate.company/backend/uploads';

// Создаем все необходимые директории при старте
const initUploadDirectories = async () => {
  const dirs = [
    path.join(FRONTEND_UPLOADS_BASE, 'properties', 'photos'),
    path.join(FRONTEND_UPLOADS_BASE, 'properties', 'floor-plans'),
    path.join(FRONTEND_UPLOADS_BASE, 'properties', 'vr'),
    path.join(FRONTEND_UPLOADS_BASE, 'properties', 'videos'),
    path.join(FRONTEND_UPLOADS_BASE, 'properties', 'videos', 'thumbnails'),
  ];

  for (const dir of dirs) {
    try {
      await fs.ensureDir(dir);
      logger.info(`Created/verified directory: ${dir}`);
    } catch (error) {
      logger.error(`Failed to create directory ${dir}:`, error);
    }
  }
};

initUploadDirectories().catch(console.error);

// Multer storage для фотографий
const propertyPhotosStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadPath = path.join(FRONTEND_UPLOADS_BASE, 'properties', 'photos');
    try {
      await fs.ensureDir(uploadPath);
      cb(null, uploadPath);
    } catch (error: any) {
      logger.error(`Failed to create photos directory: ${error.message}`);
      cb(error, uploadPath);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Multer storage для планировок
const floorPlanStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadPath = path.join(FRONTEND_UPLOADS_BASE, 'properties', 'floor-plans');
    try {
      await fs.ensureDir(uploadPath);
      cb(null, uploadPath);
    } catch (error: any) {
      logger.error(`Failed to create floor-plans directory: ${error.message}`);
      cb(error, uploadPath);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Multer storage для VR панорам
const vrPanoramaStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadPath = path.join(FRONTEND_UPLOADS_BASE, 'properties', 'vr');
    try {
      await fs.ensureDir(uploadPath);
      cb(null, uploadPath);
    } catch (error: any) {
      logger.error(`Failed to create vr directory: ${error.message}`);
      cb(error, uploadPath);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Multer storage для видео
const videoStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadPath = path.join(FRONTEND_UPLOADS_BASE, 'properties', 'videos');
    try {
      await fs.ensureDir(uploadPath);
      logger.info(`Saving video to: ${uploadPath}`);
      cb(null, uploadPath);
    } catch (error: any) {
      logger.error(`Failed to create videos directory: ${error.message}`);
      cb(error, uploadPath);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Фильтр для изображений
const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Только изображения разрешены'));
  }
};

// Фильтр для видео
const videoFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska'
  ];
  
  if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Только видео файлы разрешены (MP4, MOV, AVI, WebM, MKV)'));
  }
};

// Экспорт multer инстансов
export const uploadPropertyPhotos = multer({
  storage: propertyPhotosStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

export const uploadFloorPlan = multer({
  storage: floorPlanStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

export const uploadVRPanorama = multer({
  storage: vrPanoramaStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Для видео увеличиваем лимит до 5GB
export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB
  }
});
logger.info('='.repeat(50));
logger.info('VIDEO UPLOAD CONFIG:');
logger.info(`Max video size: ${5 * 1024 * 1024 * 1024} bytes (5GB)`);
logger.info('='.repeat(50));
export const UPLOAD_PATHS = {
  BASE: FRONTEND_UPLOADS_BASE,
  PHOTOS: path.join(FRONTEND_UPLOADS_BASE, 'properties', 'photos'),
  FLOOR_PLANS: path.join(FRONTEND_UPLOADS_BASE, 'properties', 'floor-plans'),
  VR_PANORAMAS: path.join(FRONTEND_UPLOADS_BASE, 'properties', 'vr'),
  VIDEOS: path.join(FRONTEND_UPLOADS_BASE, 'properties', 'videos'),
  VIDEO_THUMBNAILS: path.join(FRONTEND_UPLOADS_BASE, 'properties', 'videos', 'thumbnails'),
};

logger.info(`Upload paths configured:`, UPLOAD_PATHS);