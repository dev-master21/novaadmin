// backend/src/services/imageProcessor.service.ts
import sharp from 'sharp';
import path from 'path';
import fs from 'fs-extra';
import logger from '../utils/logger';

// Настройки обработки
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 85;
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 400;

interface ProcessedImage {
  path: string;
  thumbnailPath: string;
  width: number;
  height: number;
  size: number;
}

class ImageProcessorService {
  /**
   * Обработка одного изображения: сжатие + генерация thumbnail
   */
  async processImage(inputPath: string): Promise<ProcessedImage> {
    try {
      // Проверяем существование файла
      if (!await fs.pathExists(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
      }

      // Создаем временный путь для обработанного изображения
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const basename = path.basename(inputPath, ext);
      const tempPath = path.join(dir, `${basename}_temp${ext}`);
      const thumbnailPath = path.join(dir, `${basename}_thumb.jpg`);

      // Читаем метаданные оригинального изображения
      const metadata = await sharp(inputPath).metadata();
      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;

      // Вычисляем новые размеры с сохранением пропорций
      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (originalWidth > originalHeight) {
        // Горизонтальное изображение
        if (originalWidth > MAX_WIDTH) {
          targetWidth = MAX_WIDTH;
          targetHeight = Math.round(originalHeight * (MAX_WIDTH / originalWidth));
        }
      } else {
        // Вертикальное или квадратное изображение
        if (originalHeight > MAX_HEIGHT) {
          targetHeight = MAX_HEIGHT;
          targetWidth = Math.round(originalWidth * (MAX_HEIGHT / originalHeight));
        }
      }

      // Обрабатываем основное изображение во временный файл
      await sharp(inputPath)
        .resize(targetWidth, targetHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: QUALITY,
          progressive: true,
          mozjpeg: true
        })
        .toFile(tempPath);

      // Удаляем оригинал и переименовываем временный файл
      await fs.remove(inputPath);
      await fs.move(tempPath, inputPath);

      // Создаем thumbnail
      await sharp(inputPath)
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({
          quality: 80,
          progressive: true
        })
        .toFile(thumbnailPath);

      // Получаем информацию об обработанном файле
      const stats = await fs.stat(inputPath);
      const processedMetadata = await sharp(inputPath).metadata();

      logger.info(`Image processed: ${inputPath}`, {
        original: { width: originalWidth, height: originalHeight },
        processed: { width: processedMetadata.width, height: processedMetadata.height },
        size: stats.size
      });

      return {
        path: inputPath,
        thumbnailPath,
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0,
        size: stats.size
      };

    } catch (error: any) {
      logger.error('Image processing error:', error);
      throw new Error(`Image processing error: ${error.message}`);
    }
  }

  /**
   * Обработка нескольких изображений параллельно
   */
  async processMultipleImages(inputPaths: string[]): Promise<ProcessedImage[]> {
    try {
      // Обрабатываем все изображения параллельно
      const results = await Promise.all(
        inputPaths.map(path => this.processImage(path))
      );
      
      logger.info(`Processed ${results.length} images in parallel`);
      return results;
      
    } catch (error: any) {
      logger.error('Multiple images processing error:', error);
      throw error;
    }
  }

  /**
   * Удаление изображения и его thumbnail
   */
  async deleteImage(imagePath: string): Promise<void> {
    try {
      // Удаляем основное изображение
      if (await fs.pathExists(imagePath)) {
        await fs.remove(imagePath);
        logger.info(`Deleted image: ${imagePath}`);
      }

      // Удаляем thumbnail
      const dir = path.dirname(imagePath);
      const ext = path.extname(imagePath);
      const basename = path.basename(imagePath, ext);
      const thumbnailPath = path.join(dir, `${basename}_thumb.jpg`);

      if (await fs.pathExists(thumbnailPath)) {
        await fs.remove(thumbnailPath);
        logger.info(`Deleted thumbnail: ${thumbnailPath}`);
      }

    } catch (error: any) {
      logger.error('Delete image error:', error);
      throw error;
    }
  }
}

export const imageProcessorService = new ImageProcessorService();