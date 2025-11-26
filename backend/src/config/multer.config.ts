// backend/src/config/multer.config.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';

// Базовый путь к uploads клиентского сайта
const UPLOAD_BASE = config.upload.basePath;

// Создаем директории если их нет
const propertiesDir = path.join(UPLOAD_BASE, 'properties');
const photosDir = path.join(propertiesDir, 'photos');
const floorPlansDir = path.join(propertiesDir, 'floor-plans');
const videosDir = path.join(propertiesDir, 'videos');
const vrPanoramasDir = path.join(UPLOAD_BASE, 'vr-panoramas');

fs.ensureDirSync(photosDir);
fs.ensureDirSync(floorPlansDir);
fs.ensureDirSync(videosDir);
fs.ensureDirSync(vrPanoramasDir);

console.log('📁 Upload directories initialized:');
console.log(`   Photos: ${photosDir}`);
console.log(`   Floor Plans: ${floorPlansDir}`);
console.log(`   Videos: ${videosDir}`);
console.log(`   VR Panoramas: ${vrPanoramasDir}`);

// Storage для фотографий объектов
const propertyPhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, photosDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Storage для планировок
const floorPlanStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, floorPlansDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Storage для видео
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, videosDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Storage для VR панорам
const vrPanoramaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, vrPanoramasDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Фильтр файлов (только изображения)
const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Разрешены только файлы изображений!'));
  }
};

// Фильтр для видео
const videoFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /mp4|avi|mov|wmv|flv|mkv|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('video/');

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Разрешены только видео файлы!'));
  }
};

// ✅ ИСПРАВЛЕНО: Multer configuration для фотографий объектов
export const uploadPropertyPhotos = multer({
  storage: propertyPhotoStorage,
  limits: {
    fileSize: 50 * 1024 * 1024,      // 50MB на один файл
    files: 200,                       // ✅ УВЕЛИЧЕНО: до 200 файлов за раз
    fields: 20,                       // ✅ ДОБАВЛЕНО: максимум 20 текстовых полей (для category и т.д.)
    fieldNameSize: 200,               // ✅ ДОБАВЛЕНО: максимальная длина имени поля
    fieldSize: 2 * 1024 * 1024,      // ✅ ДОБАВЛЕНО: 2MB для текстовых полей
    parts: 220                        // ✅ ДОБАВЛЕНО: общее количество частей (files + fields)
  },
  fileFilter: imageFilter
});

// Multer configuration для планировок
export const uploadFloorPlan = multer({
  storage: floorPlanStorage,
  limits: {
    fileSize: config.upload.maxFileSize,
    fields: 10,
    fieldNameSize: 200,
    fieldSize: 1 * 1024 * 1024
  },
  fileFilter: imageFilter
});

// ✅ ИСПРАВЛЕНО: Multer configuration для видео (максимум 5GB)
export const uploadPropertyVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024,  // ✅ ИЗМЕНЕНО: 5GB на видео файл
    files: 10,                          // ✅ ДОБАВЛЕНО: до 10 видео за раз
    fields: 20,
    fieldNameSize: 200,
    fieldSize: 2 * 1024 * 1024
  },
  fileFilter: videoFilter
});

// Multer configuration для VR панорам
export const uploadVRPanorama = multer({
  storage: vrPanoramaStorage,
  limits: {
    fileSize: config.upload.maxFileSize,
    fields: 10,
    fieldNameSize: 200,
    fieldSize: 1 * 1024 * 1024
  },
  fileFilter: imageFilter
});