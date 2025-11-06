// backend/src/routes/fileManager.routes.ts
import { Router } from 'express';
import fileManagerController from '../controllers/fileManager.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Путь для загрузки файлов в проект admin.novaestate.company
const FILE_MANAGER_UPLOAD_PATH = '/var/www/www-root/data/www/admin.novaestate.company/backend/uploads/file-manager';
const TEMP_UPLOAD_PATH = path.join(FILE_MANAGER_UPLOAD_PATH, '.temp');

fs.ensureDirSync(FILE_MANAGER_UPLOAD_PATH);
fs.ensureDirSync(TEMP_UPLOAD_PATH);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_UPLOAD_PATH);
  },
  filename: (_req, file, cb) => {
    try {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const uniqueName = `${uuidv4()}_${originalName}`;
      cb(null, uniqueName);
    } catch (error) {
      console.error('Filename encoding error:', error);
      cb(null, `${uuidv4()}_${file.originalname}`);
    }
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB
  }
});

// ========== КРИТИЧНО: Этот роут должен быть ПЕРВЫМ ==========
// Раздача файлов с проверкой авторизации
// Используем wildcard (*) для захвата всего пути после /serve/
router.get('/serve/*', authenticate, requirePermission('file_manager.view'), (req, res) => {
  fileManagerController.serveFile(req, res);
});
// ===========================================================

// Все остальные роуты также требуют аутентификации
router.use(authenticate);

// Просмотр содержимого папки
router.get('/browse', requirePermission('file_manager.view'), fileManagerController.browse.bind(fileManagerController));

// Создать папку
router.post('/folders', requirePermission('file_manager.edit'), fileManagerController.createFolder.bind(fileManagerController));

// Загрузить файлы
router.post('/upload', requirePermission('file_manager.upload'), upload.array('files', 50), fileManagerController.uploadFiles.bind(fileManagerController));

// Скачать файл
router.get('/download/:fileId', requirePermission('file_manager.download'), fileManagerController.downloadFile.bind(fileManagerController));

// Скачать папку (ZIP)
router.get('/download-folder/:folderId', requirePermission('file_manager.download'), fileManagerController.downloadFolder.bind(fileManagerController));

// Скачать выбранные файлы (ZIP)
router.post('/download-multiple', requirePermission('file_manager.download'), fileManagerController.downloadMultiple.bind(fileManagerController));

// Удалить файл
router.delete('/files/:fileId', requirePermission('file_manager.delete'), fileManagerController.deleteFile.bind(fileManagerController));

// Удалить папку
router.delete('/folders/:folderId', requirePermission('file_manager.delete'), fileManagerController.deleteFolder.bind(fileManagerController));

// Переименовать файл
router.put('/files/:fileId/rename', requirePermission('file_manager.edit'), fileManagerController.renameFile.bind(fileManagerController));

// Переименовать папку
router.put('/folders/:folderId/rename', requirePermission('file_manager.edit'), fileManagerController.renameFolder.bind(fileManagerController));

// Получить права доступа к папке
router.get('/folders/:folderId/permissions', requirePermission('file_manager.manage_permissions'), fileManagerController.getFolderPermissions.bind(fileManagerController));

// Установить права доступа к папке
router.post('/folders/:folderId/permissions', requirePermission('file_manager.manage_permissions'), fileManagerController.setFolderPermissions.bind(fileManagerController));

// Раздача файлов по ID (более надежный способ)
router.get('/file/:fileId', authenticate, requirePermission('file_manager.view'), fileManagerController.serveFileById.bind(fileManagerController));

// Импорт из Google Drive
router.post('/import-from-google-drive', requirePermission('file_manager.upload'), fileManagerController.importFromGoogleDrive.bind(fileManagerController));

// Массовое удаление файлов
router.post('/delete-multiple', requirePermission('file_manager.delete'), fileManagerController.deleteMultipleFiles.bind(fileManagerController));

export default router;