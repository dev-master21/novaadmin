// backend/src/services/imageProcessor.service.ts
import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';

class ImageProcessorService {
  /**
   * Обработка изображения с автоматическим созданием thumbnail
   */
  async processImage(
    inputPath: string,
    outputPath?: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
      createThumbnail?: boolean;
      thumbnailSize?: number;
    } = {}
  ): Promise<void> {
    const {
      width,
      height,
      quality = 80,
      format = 'jpeg',
      createThumbnail = true,
      thumbnailSize = 400
    } = options;

    try {
      let image = sharp(inputPath);

      // Обрабатываем основное изображение
      if (width || height) {
        image = image.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Конвертируем в нужный формат
      switch (format) {
        case 'jpeg':
          image = image.jpeg({ quality, progressive: true });
          break;
        case 'png':
          image = image.png({ compressionLevel: 9 });
          break;
        case 'webp':
          image = image.webp({ quality });
          break;
      }

      // Сохраняем основное изображение
      const finalOutputPath = outputPath || inputPath;
      await image.toFile(finalOutputPath);

      // Создаем thumbnail если нужно
      if (createThumbnail) {
        const ext = path.extname(finalOutputPath);
        const thumbnailPath = finalOutputPath.replace(ext, `_thumb${ext}`);
        
        await sharp(inputPath)
          .resize(thumbnailSize, thumbnailSize, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 75, progressive: true })
          .toFile(thumbnailPath);
      }

      // Удаляем временный файл если он отличается от выходного
      if (outputPath && inputPath !== outputPath) {
        await fs.remove(inputPath).catch(() => {});
      }
    } catch (error) {
      throw new Error(`Image processing error: ${error}`);
    }
  }

  /**
   * Обработка нескольких изображений с созданием thumbnails
   */
  async processMultipleImages(
    filePaths: string[],
    options: {
      quality?: number;
      createThumbnail?: boolean;
      thumbnailSize?: number;
    } = {}
  ): Promise<void> {
    const { quality = 80, createThumbnail = true, thumbnailSize = 400 } = options;

    const promises = filePaths.map(filePath =>
      this.processImage(filePath, undefined, { 
        quality, 
        createThumbnail,
        thumbnailSize 
      })
    );
    
    await Promise.all(promises);
  }

  /**
   * Создание thumbnail для существующего изображения
   */
  async createThumbnail(
    inputPath: string,
    outputPath?: string,
    size: number = 400
  ): Promise<void> {
    const thumbnailPath = outputPath || inputPath.replace(
      path.extname(inputPath), 
      `_thumb${path.extname(inputPath)}`
    );

    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 75, progressive: true })
      .toFile(thumbnailPath);
  }

  /**
   * Удаление изображения и его thumbnail
   */
  async deleteImage(imagePath: string): Promise<void> {
    try {
      // Удаляем основное изображение
      await fs.remove(imagePath);
      
      // Удаляем thumbnail
      const ext = path.extname(imagePath);
      const thumbnailPath = imagePath.replace(ext, `_thumb${ext}`);
      await fs.remove(thumbnailPath).catch(() => {});
    } catch (error) {
      throw new Error(`Delete image error: ${error}`);
    }
  }

  /**
   * Получение информации об изображении
   */
  async getImageInfo(imagePath: string): Promise<sharp.Metadata> {
    return await sharp(imagePath).metadata();
  }
}

export const imageProcessorService = new ImageProcessorService();