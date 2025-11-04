// backend/src/controllers/fileManager.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';

class FileManagerController {
  // Путь к файлам file-manager в проекте admin.novaestate.company
  private fileManagerPath = '/var/www/www-root/data/www/admin.novaestate.company/backend/uploads/file-manager';

  constructor() {
    fs.ensureDirSync(this.fileManagerPath);
  }

  /**
   * Раздать файл с проверкой авторизации
   * GET /api/file-manager/serve/*
   */
  async serveFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('='.repeat(80));
      logger.info('SERVE FILE REQUEST');
      logger.info('='.repeat(80));
      
      // Логируем все что можем о запросе
      logger.info(`req.path: ${req.path}`);
      logger.info(`req.originalUrl: ${req.originalUrl}`);
      logger.info(`req.url: ${req.url}`);
      logger.info(`req.baseUrl: ${req.baseUrl}`);
      logger.info(`req.params: ${JSON.stringify(req.params)}`);
      logger.info(`req.params[0]: ${req.params[0]}`);
      
      // ИСПРАВЛЕНО: Используем req.params[0] который содержит путь после /serve/*
      let relativePath = req.params[0] || '';
      
      logger.info(`Relative path (raw from params): ${relativePath}`);
      
      if (!relativePath) {
        // Попробуем альтернативный способ
        if (req.path.startsWith('/serve/')) {
          relativePath = req.path.substring('/serve/'.length);
          logger.info(`Extracted from req.path: ${relativePath}`);
        } else if (req.url.startsWith('/serve/')) {
          relativePath = req.url.substring('/serve/'.length);
          logger.info(`Extracted from req.url: ${relativePath}`);
        }
      }
      
      if (!relativePath) {
        logger.error('Could not extract relative path');
        res.status(400).json({
          success: false,
          message: 'Не указан путь к файлу'
        });
        return;
      }

      // Декодируем URL (если нужно)
      try {
        const decodedPath = decodeURIComponent(relativePath);
        logger.info(`Relative path (after decode): ${decodedPath}`);
        relativePath = decodedPath;
      } catch (decodeError) {
        logger.warn(`Could not decode path, using as is:`, decodeError);
      }

      // Формируем полный путь к файлу
      const filePath = path.join(this.fileManagerPath, relativePath);
      logger.info(`Base path: ${this.fileManagerPath}`);
      logger.info(`Full file path: ${filePath}`);

      // Проверяем безопасность пути
      const normalizedPath = path.normalize(filePath);
      const normalizedBase = path.normalize(this.fileManagerPath);
      
      if (!normalizedPath.startsWith(normalizedBase)) {
        logger.error(`Security violation: path traversal attempt`);
        logger.error(`Normalized path: ${normalizedPath}`);
        logger.error(`Normalized base: ${normalizedBase}`);
        res.status(403).json({
          success: false,
          message: 'Доступ запрещен'
        });
        return;
      }

      // Проверяем существование файла
      const exists = await fs.pathExists(filePath);
      logger.info(`File exists: ${exists}`);
      
      if (!exists) {
        logger.error(`FILE NOT FOUND: ${filePath}`);
        
        // ДИАГНОСТИКА: Ищем похожие файлы
        const dirPath = path.dirname(filePath);
        const fileName = path.basename(filePath);
        
        logger.info(`Directory: ${dirPath}`);
        logger.info(`Looking for: ${fileName}`);
        
        if (await fs.pathExists(dirPath)) {
          logger.info(`Directory exists, listing contents:`);
          try {
            const filesInDir = await fs.readdir(dirPath);
            logger.info(`Files in directory (${filesInDir.length}):`);
            filesInDir.forEach((f, index) => {
              logger.info(`  [${index}] ${f}`);
              // Также логируем в hex для отладки кодировки
              const hex = Buffer.from(f, 'utf8').toString('hex');
              logger.info(`      HEX: ${hex}`);
            });
            
            // Ищем файл case-insensitive
            const foundFile = filesInDir.find(f => f.toLowerCase() === fileName.toLowerCase());
            if (foundFile && foundFile !== fileName) {
              logger.info(`Found case-insensitive match: ${foundFile}`);
            }
          } catch (readError) {
            logger.error(`Error reading directory:`, readError);
          }
        } else {
          logger.error(`Directory does not exist: ${dirPath}`);
          
          // Проверяем родительскую директорию
          const parentDir = path.dirname(dirPath);
          if (await fs.pathExists(parentDir)) {
            logger.info(`Parent directory exists: ${parentDir}`);
            try {
              const parentFiles = await fs.readdir(parentDir);
              logger.info(`Parent directory contents (${parentFiles.length}):`);
              parentFiles.forEach(f => logger.info(`  - ${f}`));
            } catch (e) {
              logger.error('Error reading parent dir:', e);
            }
          }
        }
        
        res.status(404).json({
          success: false,
          message: 'Файл не найден',
          debug: {
            requestedPath: relativePath,
            fullPath: filePath,
            exists: false
          }
        });
        return;
      }

      // Проверяем что это файл
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        logger.error(`Path is not a file: ${filePath}`);
        res.status(400).json({
          success: false,
          message: 'Указанный путь не является файлом'
        });
        return;
      }

      // Определяем MIME тип
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
      };

      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      logger.info(`SUCCESS: Serving file`);
      logger.info(`  MIME type: ${mimeType}`);
      logger.info(`  File size: ${stats.size} bytes`);
      logger.info('='.repeat(80));

      // Устанавливаем заголовки
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Accept-Ranges', 'bytes');

      // Отправляем файл
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        logger.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Ошибка чтения файла'
          });
        }
      });

    } catch (error) {
      logger.error('='.repeat(80));
      logger.error('SERVE FILE ERROR:', error);
      logger.error('='.repeat(80));
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Ошибка раздачи файла'
        });
      }
    }
  }
  /**
   * Раздать файл по ID
   * GET /api/file-manager/file/:fileId
   */
  async serveFileById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const fileId = parseInt(req.params.fileId);

      logger.info('='.repeat(80));
      logger.info(`SERVE FILE BY ID: ${fileId}`);

      if (!fileId || isNaN(fileId)) {
        logger.error('Invalid file ID');
        res.status(400).json({
          success: false,
          message: 'Неверный ID файла'
        });
        return;
      }

      // Получаем информацию о файле из базы
      logger.info('Executing query...');
      const result = await db.query(
        'SELECT * FROM file_manager_files WHERE id = ?',
        [fileId]
      );

      logger.info('Query executed');
      logger.info(`Result type: ${typeof result}`);
      logger.info(`Result is array: ${Array.isArray(result)}`);
      logger.info(`Result length: ${result ? (result as any).length : 'null'}`);
      logger.info(`Full result: ${JSON.stringify(result, null, 2)}`);

      // mysql2/promise возвращает [rows, fields]
      const rows = Array.isArray(result) && result.length > 0 ? result[0] : result;
      logger.info(`Rows type: ${typeof rows}`);
      logger.info(`Rows is array: ${Array.isArray(rows)}`);
      logger.info(`Rows length: ${(rows as any)?.length}`);
      logger.info(`Rows content: ${JSON.stringify(rows, null, 2)}`);

      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        logger.error(`File not found in database: ID ${fileId}`);
        res.status(404).json({
          success: false,
          message: 'Файл не найден в базе данных'
        });
        return;
      }

      const file = Array.isArray(rows) ? rows[0] : rows;
      logger.info(`File object type: ${typeof file}`);
      logger.info(`File object: ${JSON.stringify(file, null, 2)}`);

      if (!file) {
        logger.error('File object is null or undefined');
        res.status(404).json({
          success: false,
          message: 'Файл не найден'
        });
        return;
      }

      logger.info(`File record:`, {
        id: file.id,
        original_name: file.original_name,
        file_path: file.file_path,
        mime_type: file.mime_type,
        file_size: file.file_size
      });

      const filePath = file.file_path;

      if (!filePath) {
        logger.error('File path is empty in database');
        res.status(500).json({
          success: false,
          message: 'Путь к файлу не указан в базе данных'
        });
        return;
      }

      logger.info(`Checking file existence: ${filePath}`);

      // Проверяем существование файла
      const fileExists = await fs.pathExists(filePath);
      logger.info(`File exists: ${fileExists}`);

      if (!fileExists) {
        logger.error(`File not found on disk: ${filePath}`);
        res.status(404).json({
          success: false,
          message: 'Файл не найден на диске',
          path: filePath
        });
        return;
      }

      // Проверяем что это файл
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        logger.error('Path is not a file');
        res.status(400).json({
          success: false,
          message: 'Указанный путь не является файлом'
        });
        return;
      }

      logger.info(`Serving file successfully: ${file.original_name}`);
      logger.info(`MIME type: ${file.mime_type}, Size: ${stats.size}`);

      // Устанавливаем заголовки
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Accept-Ranges', 'bytes');

      // Отправляем файл
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        logger.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Ошибка чтения файла'
          });
        }
      });

      logger.info('='.repeat(80));

    } catch (error) {
      logger.error('='.repeat(80));
      logger.error('Serve file by ID error:', error);
      logger.error('Stack trace:', (error as Error).stack);
      logger.error('='.repeat(80));
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Ошибка раздачи файла',
          error: (error as Error).message
        });
      }
    }
  }
  // backend/src/controllers/fileManager.controller.ts (добавить в конец класса перед закрывающей скобкой)

  /**
   * Загрузить содержимое из Google Drive
   * POST /api/file-manager/import-from-google-drive
   */
  async importFromGoogleDrive(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { googleDriveUrl, folderId } = req.body;
      const userId = req.admin!.id;

      if (!googleDriveUrl) {
        res.status(400).json({
          success: false,
          message: 'URL Google Drive не предоставлен'
        });
        return;
      }

      logger.info(`Starting Google Drive import from: ${googleDriveUrl}`);

      // Извлекаем ID папки/файла из URL
      const driveId = this.extractGoogleDriveId(googleDriveUrl);
      
      if (!driveId) {
        res.status(400).json({
          success: false,
          message: 'Не удалось извлечь ID из ссылки Google Drive'
        });
        return;
      }

      // Определяем целевую папку
      let targetPath = this.fileManagerPath;
      let targetFolderId = folderId || null;

      if (folderId) {
        const folder = await db.queryOne<any>(
          'SELECT full_path FROM file_manager_folders WHERE id = ?',
          [folderId]
        );
        if (folder) {
          targetPath = path.join(this.fileManagerPath, folder.full_path);
        }
      }

      // Отправляем первоначальный ответ
      res.json({
        success: true,
        message: 'Начата загрузка из Google Drive. Это может занять некоторое время...',
        data: { jobId: driveId }
      });

      // Запускаем асинхронную загрузку в фоне
      this.processGoogleDriveImport(driveId, targetPath, targetFolderId, userId).catch(err => {
        logger.error('Background Google Drive import failed:', err);
      });

    } catch (error) {
      logger.error('Import from Google Drive error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка импорта из Google Drive'
      });
    }
  }

  /**
   * Извлечь ID из ссылки Google Drive
   */
  private extractGoogleDriveId(url: string): string | null {
    // Паттерны для разных типов ссылок Google Drive
    const patterns = [
      /\/folders\/([a-zA-Z0-9_-]+)/,
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
      /^([a-zA-Z0-9_-]{25,})$/  // Прямой ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Обработка импорта из Google Drive (асинхронно)
   */
  private async processGoogleDriveImport(
    driveId: string,
    targetPath: string,
    targetFolderId: number | null,
    userId: number
  ): Promise<void> {
    try {
      const axios = require('axios');
      
      // Получаем информацию о ресурсе
      const metaUrl = `https://www.googleapis.com/drive/v3/files/${driveId}?fields=id,name,mimeType&key=${process.env.GOOGLE_API_KEY || ''}`;
      
      let response;
      try {
        response = await axios.get(metaUrl);
      } catch (err: any) {
        logger.error('Google Drive API error:', err.response?.data || err.message);
        
        // Пытаемся использовать публичный доступ через прямую ссылку
        return await this.downloadGoogleDrivePublic(driveId, targetPath, targetFolderId, userId);
      }

      const resource = response.data;

      if (resource.mimeType === 'application/vnd.google-apps.folder') {
        // Это папка - загружаем рекурсивно
        await this.downloadGoogleDriveFolder(driveId, targetPath, targetFolderId, userId, resource.name);
      } else {
        // Это файл - загружаем один файл
        await this.downloadGoogleDriveFile(driveId, targetPath, targetFolderId, userId, resource.name, resource.mimeType);
      }

      logger.info(`Google Drive import completed for: ${driveId}`);
    } catch (error) {
      logger.error('Process Google Drive import error:', error);
      throw error;
    }
  }

  /**
   * Загрузка публичной папки Google Drive (альтернативный метод)
   */
  private async downloadGoogleDrivePublic(
    driveId: string,
    targetPath: string,
    targetFolderId: number | null,
    userId: number
  ): Promise<void> {
    try {
      // Альтернатива: используем gdown или подобную библиотеку
      logger.warn('Using public folder download method with gdown');
      
      await this.downloadWithGdown(driveId, targetPath, targetFolderId, userId);

    } catch (error) {
      logger.error('Download public Google Drive error:', error);
      throw new Error('Невозможно загрузить из Google Drive. Убедитесь, что ссылка публичная или используйте Google API Key');
    }
  }

  /**
   * Загрузка с использованием gdown (требует установки: pip install gdown)
   */
  private async downloadWithGdown(
    driveId: string,
    targetPath: string,
    targetFolderId: number | null,
    userId: number
  ): Promise<void> {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
      // Создаем временную папку для загрузки
      const tempDownloadPath = path.join(targetPath, `temp_${driveId}`);
      await fs.ensureDir(tempDownloadPath);

      // Загружаем папку с помощью gdown
      logger.info(`Downloading with gdown to: ${tempDownloadPath}`);
      
      const command = `gdown --folder https://drive.google.com/drive/folders/${driveId} -O "${tempDownloadPath}" --remaining-ok`;
      
      const { stdout, stderr } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
      
      if (stderr) {
        logger.warn('gdown stderr:', stderr);
      }
      
      logger.info('gdown stdout:', stdout);

      // Обрабатываем загруженные файлы
      await this.processDownloadedFolder(tempDownloadPath, targetPath, targetFolderId, userId);

      // Удаляем временную папку
      await fs.remove(tempDownloadPath);

      logger.info('Google Drive download with gdown completed');
    } catch (error: any) {
      logger.error('Download with gdown error:', error);
      throw new Error(`Ошибка загрузки через gdown: ${error.message}. Убедитесь, что gdown установлен: pip install gdown`);
    }
  }

  /**
   * Обработка загруженной папки
   */
  private async processDownloadedFolder(
    sourcePath: string,
    targetBasePath: string,
    parentFolderId: number | null,
    userId: number,
    relativePath: string = ''
  ): Promise<void> {
    try {
      const items = await fs.readdir(sourcePath);

      for (const item of items) {
        const itemPath = path.join(sourcePath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          // Создаем папку в БД
          const folderName = item;
          let fullPath = relativePath ? `${relativePath}/${folderName}` : folderName;
          
          if (parentFolderId) {
            const parentFolder = await db.queryOne<any>(
              'SELECT full_path FROM file_manager_folders WHERE id = ?',
              [parentFolderId]
            );
            if (parentFolder) {
              fullPath = `${parentFolder.full_path}/${folderName}`;
            }
          }

          const physicalPath = path.join(targetBasePath, relativePath, folderName);
          await fs.ensureDir(physicalPath);

          const result: any = await db.query(
            `INSERT INTO file_manager_folders (folder_name, parent_id, full_path, created_by)
             VALUES (?, ?, ?, ?)`,
            [folderName, parentFolderId || null, fullPath, userId]
          );

          const newFolderId = Array.isArray(result) && result[0] ? result[0].insertId : result.insertId;

          logger.info(`Created folder: ${fullPath}`);

          // Рекурсивно обрабатываем содержимое папки
          await this.processDownloadedFolder(
            itemPath,
            targetBasePath,
            newFolderId,
            userId,
            relativePath ? `${relativePath}/${folderName}` : folderName
          );
        } else {
          // Копируем файл
          const fileName = item;
          const targetFilePath = path.join(targetBasePath, relativePath, fileName);
          
          await fs.copy(itemPath, targetFilePath);

          // Добавляем в БД
          const fileSize = stats.size;
          const mimeType = this.getMimeType(fileName);

          await db.query(
            `INSERT INTO file_manager_files (folder_id, file_name, original_name, file_path, file_size, mime_type, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [parentFolderId || null, fileName, fileName, targetFilePath.replace(/\\/g, '/'), fileSize, mimeType, userId]
          );

          logger.info(`Copied file: ${fileName}`);
        }
      }
    } catch (error) {
      logger.error('Process downloaded folder error:', error);
      throw error;
    }
  }

  /**
   * Загрузка папки Google Drive через API
   */
  private async downloadGoogleDriveFolder(
    folderId: string,
    targetPath: string,
    parentFolderId: number | null,
    userId: number,
    folderName: string
  ): Promise<void> {
    const axios = require('axios');

    try {
      // Создаем папку
      const fullPath = parentFolderId
        ? `${(await db.queryOne<any>('SELECT full_path FROM file_manager_folders WHERE id = ?', [parentFolderId]))?.full_path}/${folderName}`
        : folderName;

      const physicalPath = path.join(targetPath, folderName);
      await fs.ensureDir(physicalPath);

      const result: any = await db.query(
        `INSERT INTO file_manager_folders (folder_name, parent_id, full_path, created_by)
         VALUES (?, ?, ?, ?)`,
        [folderName, parentFolderId || null, fullPath, userId]
      );

      const newFolderId = Array.isArray(result) && result[0] ? result[0].insertId : result.insertId;

      // Получаем список файлов в папке
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,size)&key=${process.env.GOOGLE_API_KEY}`;
      const response = await axios.get(listUrl);
      const files = response.data.files || [];

      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // Рекурсивно загружаем вложенную папку
          await this.downloadGoogleDriveFolder(file.id, physicalPath, newFolderId, userId, file.name);
        } else {
          // Загружаем файл
          await this.downloadGoogleDriveFile(file.id, physicalPath, newFolderId, userId, file.name, file.mimeType);
        }
      }

      logger.info(`Downloaded folder: ${folderName}`);
    } catch (error) {
      logger.error('Download Google Drive folder error:', error);
      throw error;
    }
  }

  /**
   * Загрузка файла Google Drive через API
   */
  private async downloadGoogleDriveFile(
    fileId: string,
    targetPath: string,
    folderId: number | null,
    userId: number,
    fileName: string,
    mimeType: string
  ): Promise<void> {
    const axios = require('axios');

    try {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${process.env.GOOGLE_API_KEY}`;
      
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer'
      });

      const filePath = path.join(targetPath, fileName);
      await fs.writeFile(filePath, response.data);

      const fileSize = response.data.length;

      await db.query(
        `INSERT INTO file_manager_files (folder_id, file_name, original_name, file_path, file_size, mime_type, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [folderId || null, fileName, fileName, filePath.replace(/\\/g, '/'), fileSize, mimeType, userId]
      );

      logger.info(`Downloaded file: ${fileName}`);
    } catch (error) {
      logger.error('Download Google Drive file error:', error);
      throw error;
    }
  }

  /**
   * Получить MIME тип файла по расширению
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Массовое удаление файлов
   * POST /api/file-manager/delete-multiple
   */
  async deleteMultipleFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { fileIds } = req.body;

      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Не указаны файлы для удаления'
        });
        return;
      }

      logger.info(`Deleting ${fileIds.length} files`);

      let deletedCount = 0;
      const errors: string[] = [];

      for (const fileId of fileIds) {
        try {
          const file = await db.queryOne<any>(
            'SELECT * FROM file_manager_files WHERE id = ?',
            [fileId]
          );

          if (file) {
            // Удаляем физический файл
            if (await fs.pathExists(file.file_path)) {
              await fs.remove(file.file_path);
            }

            // Удаляем из БД
            await db.query('DELETE FROM file_manager_files WHERE id = ?', [fileId]);
            deletedCount++;
            logger.info(`File deleted: ${file.original_name}`);
          }
        } catch (err: any) {
          logger.error(`Error deleting file ${fileId}:`, err);
          errors.push(`Ошибка удаления файла ID ${fileId}: ${err.message}`);
        }
      }

      res.json({
        success: true,
        message: `Удалено файлов: ${deletedCount}${errors.length > 0 ? `, ошибок: ${errors.length}` : ''}`,
        data: {
          deletedCount,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      logger.error('Delete multiple files error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка массового удаления файлов'
      });
    }
  }
  
  /**
   * Получить содержимое папки
   * GET /api/file-manager/browse?folderId=1
   */
  async browse(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderId } = req.query;
      const userId = req.admin!.id;
      const isSuperAdmin = req.admin!.is_super_admin;

      // Получаем подпапки
      let foldersQuery = `
        SELECT f.id, f.folder_name, f.parent_id, f.full_path, f.created_at, f.created_by,
               u.full_name as created_by_name
        FROM file_manager_folders f
        LEFT JOIN admin_users u ON f.created_by = u.id
        WHERE ${folderId ? 'f.parent_id = ?' : 'f.parent_id IS NULL'}
      `;

      const foldersParams: any[] = folderId ? [folderId] : [];

      // Для не-суперадминов проверяем права
      if (!isSuperAdmin) {
        foldersQuery += `
          AND (
            f.created_by = ? 
            OR EXISTS (
              SELECT 1 FROM file_manager_folder_permissions fp 
              WHERE fp.folder_id = f.id AND fp.user_id = ? AND fp.can_view = TRUE
            )
          )
        `;
        // ИСПРАВЛЕНО: преобразуем в any для совместимости
        foldersParams.push(userId as any, userId as any);
      }

      foldersQuery += ' ORDER BY f.folder_name ASC';

      const folders = await db.query<any>(foldersQuery, foldersParams);

      // Получаем права для каждой папки
      for (const folder of folders) {
        if (isSuperAdmin) {
          folder.permissions = {
            can_view: true,
            can_upload: true,
            can_download: true,
            can_edit: true,
            can_delete: true
          };
        } else {
          const perms = await db.queryOne<any>(
            `SELECT can_view, can_upload, can_download, can_edit, can_delete 
             FROM file_manager_folder_permissions 
             WHERE folder_id = ? AND user_id = ?`,
            [folder.id, userId]
          );
          folder.permissions = perms || {
            can_view: folder.created_by === userId,
            can_upload: folder.created_by === userId,
            can_download: folder.created_by === userId,
            can_edit: folder.created_by === userId,
            can_delete: folder.created_by === userId
          };
        }
      }

      // Получаем файлы в папке
      let filesQuery = `
        SELECT f.id, f.file_name, f.original_name, f.file_path, f.file_size, 
               f.mime_type, f.created_at, f.created_by, u.full_name as created_by_name
        FROM file_manager_files f
        LEFT JOIN admin_users u ON f.created_by = u.id
        WHERE ${folderId ? 'f.folder_id = ?' : 'f.folder_id IS NULL'}
      `;

      const filesParams: any[] = folderId ? [folderId] : [];

      // Для не-суперадминов проверяем права на родительскую папку
      if (!isSuperAdmin && folderId) {
        filesQuery += `
          AND EXISTS (
            SELECT 1 FROM file_manager_folders folder
            LEFT JOIN file_manager_folder_permissions fp ON folder.id = fp.folder_id AND fp.user_id = ?
            WHERE folder.id = ? AND (folder.created_by = ? OR fp.can_view = TRUE)
          )
        `;
        // ИСПРАВЛЕНО: преобразуем в any для совместимости
        filesParams.push(userId as any, folderId as any, userId as any);
      }

      filesQuery += ' ORDER BY f.original_name ASC';

      const files = await db.query<any>(filesQuery, filesParams);

      // Получаем путь breadcrumbs
      let breadcrumbs: any[] = [];
      if (folderId) {
        const folder = await db.queryOne<any>(
          'SELECT id, folder_name, parent_id FROM file_manager_folders WHERE id = ?',
          [folderId]
        );
        if (folder) {
          breadcrumbs = await this.getBreadcrumbs(folder);
        }
      }

      res.json({
        success: true,
        data: {
          folders,
          files,
          breadcrumbs,
          currentFolderId: folderId || null
        }
      });
    } catch (error) {
      logger.error('Browse error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения содержимого папки'
      });
    }
  }

 /**
   * Создать папку
   * POST /api/file-manager/folders
   */
  async createFolder(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { folder_name, parent_id } = req.body;
      const userId = req.admin!.id;

      if (!folder_name || folder_name.trim() === '') {
        await db.rollback(connection);
        res.status(400).json({
          success: false,
          message: 'Название папки не может быть пустым'
        });
        return;
      }

      // Получаем полный путь
      let fullPath = folder_name;
      if (parent_id) {
        const parentFolder = await db.queryOne<any>(
          'SELECT full_path FROM file_manager_folders WHERE id = ?',
          [parent_id]
        );
        if (parentFolder) {
          fullPath = `${parentFolder.full_path}/${folder_name}`;
        }
      }

      // Создаем физическую папку
      const physicalPath = path.join(this.fileManagerPath, fullPath);
      await fs.ensureDir(physicalPath);

      // Создаем запись в БД
      const result: any = await connection.query(
        `INSERT INTO file_manager_folders (folder_name, parent_id, full_path, created_by)
         VALUES (?, ?, ?, ?)`,
        [folder_name, parent_id || null, fullPath, userId]
      );

      // ИСПРАВЛЕНО: правильное получение insertId
      let folderId: number;
      if (Array.isArray(result) && result[0]) {
        folderId = result[0].insertId;
      } else if (result.insertId) {
        folderId = result.insertId;
      } else {
        throw new Error('Failed to get folder ID');
      }

      await db.commit(connection);

      logger.info(`Folder created: ${fullPath} by user ${req.admin?.username}`);

      res.status(201).json({
        success: true,
        message: 'Папка успешно создана',
        data: { folderId, fullPath }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Create folder error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания папки'
      });
    }
  }

/**
   * Загрузить файлы
   * POST /api/file-manager/upload
   */
  async uploadFiles(req: AuthRequest, res: Response): Promise<void> {
    const uploadedTempFiles: string[] = [];

    try {
      const { folderId } = req.body;
      const files = req.files as Express.Multer.File[];
      const userId = req.admin!.id;

      logger.info(`=== UPLOAD START ===`);
      logger.info(`folderId: ${folderId}`);
      logger.info(`Files count: ${files?.length}`);

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Нет файлов для загрузки'
        });
        return;
      }

      // Определяем целевую папку
      let targetPath = this.fileManagerPath;

      if (folderId) {
        const folder = await db.queryOne<any>(
          'SELECT full_path FROM file_manager_folders WHERE id = ?',
          [folderId]
        );

        if (folder) {
          targetPath = path.join(this.fileManagerPath, folder.full_path);
          await fs.ensureDir(targetPath);
          logger.info(`Target path: ${targetPath}`);
        }
      }

      const uploadedFiles: any[] = [];

      for (const file of files) {
        uploadedTempFiles.push(file.path);

        // Извлекаем оригинальное имя (убираем UUID префикс)
        const originalName = file.filename.substring(37); // uuid v4 = 36 символов + underscore
        const finalPath = path.join(targetPath, originalName);

        logger.info(`Moving file: ${file.path} -> ${finalPath}`);

        // Перемещаем файл из временной папки в целевую
        await fs.move(file.path, finalPath, { overwrite: true });

        // Проверяем что файл перемещен
        const fileExists = await fs.pathExists(finalPath);
        logger.info(`File moved successfully: ${fileExists}`);

        if (!fileExists) {
          throw new Error(`Failed to move file: ${originalName}`);
        }

        // Сохраняем информацию в БД
        const result: any = await db.query(
          `INSERT INTO file_manager_files 
           (folder_id, file_name, original_name, file_path, file_size, mime_type, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            folderId || null,
            originalName,
            originalName,
            finalPath.replace(/\\/g, '/'),
            file.size,
            file.mimetype,
            userId
          ]
        );

        let fileId: number | undefined;

        if (Array.isArray(result) && result[0] && result[0].insertId !== undefined) {
          fileId = result[0].insertId;
        } else if (result.insertId !== undefined) {
          fileId = result.insertId;
        }

        if (fileId === undefined) {
          logger.error('Failed to get insertId');
          continue;
        }

        uploadedFiles.push({
          id: fileId,
          original_name: originalName,
          file_size: file.size,
          file_path: finalPath
        });

        logger.info(`✅ File uploaded: ${originalName} (ID: ${fileId})`);
      }

      logger.info(`=== UPLOAD COMPLETE: ${uploadedFiles.length} files ===`);

      res.status(201).json({
        success: true,
        message: `Загружено файлов: ${uploadedFiles.length}`,
        data: { files: uploadedFiles }
      });
    } catch (error: any) {
      logger.error('Upload files error:', error);

      // Очищаем временные файлы в случае ошибки
      for (const tempFile of uploadedTempFiles) {
        if (await fs.pathExists(tempFile)) {
          await fs.remove(tempFile).catch(err => logger.error('Failed to remove temp file:', err));
        }
      }

      res.status(500).json({
        success: false,
        message: 'Ошибка загрузки файлов'
      });
    }
  }

  /**
   * ОТЛАДКА - Проверить содержимое папки
   * GET /api/file-manager/debug-folder/:folderId
   */
  async debugFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderId } = req.params;

      const folder = await db.queryOne<any>(
        'SELECT * FROM file_manager_folders WHERE id = ?',
        [folderId]
      );

      if (!folder) {
        res.status(404).json({ success: false, message: 'Папка не найдена' });
        return;
      }

      const folderPath = path.join(this.fileManagerPath, folder.full_path);

      logger.info(`Checking folder: ${folderPath}`);

      // Рекурсивная проверка содержимого
      const checkFolder = async (dirPath: string, indent: string = ''): Promise<any[]> => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const result: any[] = [];

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            const subItems = await checkFolder(fullPath, indent + '  ');
            result.push({
              name: entry.name,
              type: 'directory',
              path: fullPath,
              children: subItems
            });
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            result.push({
              name: entry.name,
              type: 'file',
              path: fullPath,
              size: stats.size
            });
          }
        }

        return result;
      };

      const structure = await checkFolder(folderPath);

      res.json({
        success: true,
        data: {
          folderPath,
          structure
        }
      });

    } catch (error) {
      logger.error('Debug folder error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка проверки папки'
      });
    }
  }
 /**
   * Скачать файл
   * GET /api/file-manager/download/:fileId
   */
  async downloadFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;

      const file = await db.queryOne<any>(
        'SELECT * FROM file_manager_files WHERE id = ?',
        [fileId]
      );

      if (!file) {
        res.status(404).json({
          success: false,
          message: 'Файл не найден'
        });
        return;
      }

      const filePath = file.file_path;
      
      if (!await fs.pathExists(filePath)) {
        res.status(404).json({
          success: false,
          message: 'Файл не найден на диске'
        });
        return;
      }

      // ИСПРАВЛЕНО: правильное кодирование имени файла с кириллицей
      const encodedFileName = encodeURIComponent(file.original_name);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error('Download file error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка скачивания файла'
      });
    }
  }

  /**
   * Скачать папку (ZIP) - С AdmZip (100% рабочий)
   * GET /api/file-manager/download-folder/:folderId
   */
async downloadFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderId } = req.params;

      const folder = await db.queryOne<any>(
        'SELECT * FROM file_manager_folders WHERE id = ?',
        [folderId]
      );

      if (!folder) {
        res.status(404).json({
          success: false,
          message: 'Папка не найдена'
        });
        return;
      }

      const folderPath = path.join(this.fileManagerPath, folder.full_path);

      if (!await fs.pathExists(folderPath)) {
        res.status(404).json({
          success: false,
          message: 'Папка не найдена на диске'
        });
        return;
      }

      // ИСПРАВЛЕННАЯ ОТЛАДКА - с полной рекурсией
      const checkFolder = async (dirPath: string, indent: string = ''): Promise<void> => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            logger.info(`${indent}📁 ${entry.name}/`);
            // ИСПРАВЛЕНО: рекурсивно проверяем содержимое подпапок
            await checkFolder(fullPath, indent + '  ');
          } else {
            const stats = await fs.stat(fullPath);
            logger.info(`${indent}📄 ${entry.name} (${stats.size} bytes)`);
          }
        }
      };

      logger.info('=== FOLDER STRUCTURE ===');
      logger.info(`Root: ${folderPath}`);
      await checkFolder(folderPath);
      logger.info('=== END STRUCTURE ===');

      logger.info(`Creating ZIP for folder: ${folderPath}`);

      // Создаем ZIP архив
      const zip = new AdmZip();
      let filesAdded = 0;
      let foldersAdded = 0;

      // Рекурсивная функция для добавления всех файлов и папок
      const addToZip = async (currentPath: string, zipBasePath: string = ''): Promise<void> => {
        logger.info(`Scanning directory: ${currentPath}`);
        
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        logger.info(`Found ${entries.length} entries in ${currentPath}`);

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const zipPath = zipBasePath ? path.join(zipBasePath, entry.name) : entry.name;

          logger.info(`Processing entry: ${entry.name}, isDir: ${entry.isDirectory()}, isFile: ${entry.isFile()}`);

          if (entry.isDirectory()) {
            foldersAdded++;
            logger.info(`📁 Entering folder: ${zipPath}`);
            // Рекурсивно обрабатываем подпапку
            await addToZip(fullPath, zipPath);
          } else if (entry.isFile()) {
            try {
              const fileBuffer = await fs.readFile(fullPath);
              zip.addFile(zipPath, fileBuffer);
              filesAdded++;
              logger.info(`✅ Added file: ${zipPath} (${fileBuffer.length} bytes)`);
            } catch (fileError) {
              logger.error(`❌ Error reading file ${fullPath}:`, fileError);
            }
          }
        }
      };

      await addToZip(folderPath);

      logger.info(`=== ZIP SUMMARY ===`);
      logger.info(`Folders processed: ${foldersAdded}`);
      logger.info(`Files added: ${filesAdded}`);

      if (filesAdded === 0) {
        logger.error('⚠️ WARNING: No files were added to the archive!');
      }

      const zipBuffer = zip.toBuffer();
      logger.info(`ZIP buffer size: ${zipBuffer.length} bytes`);

      if (zipBuffer.length < 100) {
        logger.error('⚠️ WARNING: ZIP is too small, probably empty!');
      }

      const zipFileName = `${folder.folder_name}.zip`;
      const encodedZipFileName = encodeURIComponent(zipFileName);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedZipFileName}`);
      res.setHeader('Content-Length', zipBuffer.length.toString());

      res.send(zipBuffer);

      logger.info(`Download complete`);

    } catch (error) {
      logger.error('Download folder error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Ошибка скачивания папки'
        });
      }
    }
  }
  /**
   * Скачать выбранные файлы (ZIP)
   * POST /api/file-manager/download-multiple
   */
  async downloadMultiple(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { fileIds } = req.body;

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Не указаны файлы для скачивания'
        });
        return;
      }

      const files = await db.query<any>(
        `SELECT * FROM file_manager_files WHERE id IN (${fileIds.map(() => '?').join(',')})`,
        fileIds
      );

      if (files.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Файлы не найдены'
        });
        return;
      }

      // ИСПРАВЛЕНО: правильное кодирование имени архива
      const zipFileName = 'files.zip';
      const encodedZipFileName = encodeURIComponent(zipFileName);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedZipFileName}`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.on('error', (err) => {
        logger.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Ошибка создания архива'
          });
        }
      });

      archive.pipe(res);

      for (const file of files) {
        if (await fs.pathExists(file.file_path)) {
          // Используем оригинальное имя файла для архива
          archive.file(file.file_path, { name: file.original_name });
        }
      }

      await archive.finalize();

    } catch (error) {
      logger.error('Download multiple error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Ошибка скачивания файлов'
        });
      }
    }
  }

  /**
   * Удалить файл
   * DELETE /api/file-manager/files/:fileId
   */
  async deleteFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;

      const file = await db.queryOne<any>(
        'SELECT * FROM file_manager_files WHERE id = ?',
        [fileId]
      );

      if (!file) {
        res.status(404).json({
          success: false,
          message: 'Файл не найден'
        });
        return;
      }

      // Удаляем физический файл
      if (await fs.pathExists(file.file_path)) {
        await fs.remove(file.file_path);
      }

      // Удаляем из БД
      await db.query('DELETE FROM file_manager_files WHERE id = ?', [fileId]);

      logger.info(`File deleted: ${file.original_name} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Файл успешно удален'
      });
    } catch (error) {
      logger.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления файла'
      });
    }
  }

  /**
   * Удалить папку
   * DELETE /api/file-manager/folders/:folderId
   */
  async deleteFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderId } = req.params;

      const folder = await db.queryOne<any>(
        'SELECT * FROM file_manager_folders WHERE id = ?',
        [folderId]
      );

      if (!folder) {
        res.status(404).json({
          success: false,
          message: 'Папка не найдена'
        });
        return;
      }

      const folderPath = path.join(this.fileManagerPath, folder.full_path);

      // Удаляем физическую папку
      if (await fs.pathExists(folderPath)) {
        await fs.remove(folderPath);
      }

      // Удаляем из БД (каскадно удалятся подпапки и файлы)
      await db.query('DELETE FROM file_manager_folders WHERE id = ?', [folderId]);

      logger.info(`Folder deleted: ${folder.full_path} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Папка успешно удалена'
      });
    } catch (error) {
      logger.error('Delete folder error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления папки'
      });
    }
  }

  /**
   * Переименовать файл
   * PUT /api/file-manager/files/:fileId/rename
   */
  async renameFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      const { new_name } = req.body;

      if (!new_name || new_name.trim() === '') {
        res.status(400).json({
          success: false,
          message: 'Новое имя не может быть пустым'
        });
        return;
      }

      const file = await db.queryOne<any>(
        'SELECT * FROM file_manager_files WHERE id = ?',
        [fileId]
      );

      if (!file) {
        res.status(404).json({
          success: false,
          message: 'Файл не найден'
        });
        return;
      }

      // Обновляем только original_name, физический файл не переименовываем
      await db.query(
        'UPDATE file_manager_files SET original_name = ?, updated_at = NOW() WHERE id = ?',
        [new_name, fileId]
      );

      logger.info(`File renamed: ${file.original_name} -> ${new_name} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Файл успешно переименован'
      });
    } catch (error) {
      logger.error('Rename file error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка переименования файла'
      });
    }
  }

  /**
   * Переименовать папку
   * PUT /api/file-manager/folders/:folderId/rename
   */
  async renameFolder(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { folderId } = req.params;
      const { new_name } = req.body;

      if (!new_name || new_name.trim() === '') {
        await db.rollback(connection);
        res.status(400).json({
          success: false,
          message: 'Новое имя не может быть пустым'
        });
        return;
      }

      const folder = await db.queryOne<any>(
        'SELECT * FROM file_manager_folders WHERE id = ?',
        [folderId]
      );

      if (!folder) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Папка не найдена'
        });
        return;
      }

      const oldPath = folder.full_path;
      const newPath = folder.parent_id 
        ? `${path.dirname(oldPath)}/${new_name}`
        : new_name;

      const oldPhysicalPath = path.join(this.fileManagerPath, oldPath);
      const newPhysicalPath = path.join(this.fileManagerPath, newPath);

      // Переименовываем физическую папку
      if (await fs.pathExists(oldPhysicalPath)) {
        await fs.move(oldPhysicalPath, newPhysicalPath);
      }

      // Обновляем запись в БД
      await connection.query(
        'UPDATE file_manager_folders SET folder_name = ?, full_path = ?, updated_at = NOW() WHERE id = ?',
        [new_name, newPath, folderId]
      );

      // Обновляем пути всех подпапок
      const subfolders = await connection.query<any>(
        'SELECT id, full_path FROM file_manager_folders WHERE full_path LIKE ?',
        [`${oldPath}/%`]
      );

      for (const subfolder of subfolders) {
        const newSubPath = subfolder.full_path.replace(oldPath, newPath);
        await connection.query(
          'UPDATE file_manager_folders SET full_path = ? WHERE id = ?',
          [newSubPath, subfolder.id]
        );
      }

      await db.commit(connection);

      logger.info(`Folder renamed: ${oldPath} -> ${newPath} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Папка успешно переименована'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Rename folder error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка переименования папки'
      });
    }
  }

  /**
   * Получить права доступа к папке
   * GET /api/file-manager/folders/:folderId/permissions
   */
  async getFolderPermissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderId } = req.params;

      const permissions = await db.query<any>(
        `SELECT fp.*, u.username, u.full_name
         FROM file_manager_folder_permissions fp
         LEFT JOIN admin_users u ON fp.user_id = u.id
         WHERE fp.folder_id = ?
         ORDER BY u.full_name ASC`,
        [folderId]
      );

      res.json({
        success: true,
        data: permissions
      });
    } catch (error) {
      logger.error('Get folder permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения прав доступа'
      });
    }
  }

  /**
   * Установить права доступа к папке
   * POST /api/file-manager/folders/:folderId/permissions
   */
  async setFolderPermissions(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { folderId } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        await db.rollback(connection);
        res.status(400).json({
          success: false,
          message: 'Неверный формат данных'
        });
        return;
      }

      // Удаляем старые права
      await connection.query(
        'DELETE FROM file_manager_folder_permissions WHERE folder_id = ?',
        [folderId]
      );

      // Добавляем новые права
      for (const perm of permissions) {
        await connection.query(
          `INSERT INTO file_manager_folder_permissions 
           (folder_id, user_id, can_view, can_upload, can_download, can_edit, can_delete)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            folderId,
            perm.user_id,
            perm.can_view || false,
            perm.can_upload || false,
            perm.can_download || false,
            perm.can_edit || false,
            perm.can_delete || false
          ]
        );
      }

      await db.commit(connection);

      logger.info(`Folder permissions updated for folder ${folderId} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Права доступа успешно обновлены'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Set folder permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка установки прав доступа'
      });
    }
  }

  // Вспомогательный метод для получения breadcrumbs
  private async getBreadcrumbs(folder: any): Promise<any[]> {
    const breadcrumbs: any[] = [];
    let current = folder;

    while (current) {
      breadcrumbs.unshift({
        id: current.id,
        folder_name: current.folder_name
      });

      if (current.parent_id) {
        current = await db.queryOne<any>(
          'SELECT id, folder_name, parent_id FROM file_manager_folders WHERE id = ?',
          [current.parent_id]
        );
      } else {
        current = null;
      }
    }

    return breadcrumbs;
  }
}

export default new FileManagerController();