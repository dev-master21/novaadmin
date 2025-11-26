// backend/src/services/imageCollage.service.ts
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger';
import { config } from '../config/config';

interface CollageOptions {
  width: number;
  height: number;
  quality: number;
  photosPerCollage: number;
}

class ImageCollageService {
  private readonly defaultOptions: CollageOptions = {
    width: 1800,
    height: 1800,
    quality: 85,
    photosPerCollage: 2
  };

  /**
   * Создает коллажи из массива фотографий
   */
  async createCollages(photos: Array<{url: string, category?: string}>, propertyId: number): Promise<string[]> {
    logger.info(`Creating collages for property ${propertyId} from ${photos.length} photos`);

    const categorized = this.groupPhotosByCategory(photos);
    const maxPhotos = 12;
    const selectedPhotos = this.selectPhotosFromCategories(categorized, maxPhotos);
    
    if (selectedPhotos.length < 2) {
      logger.warn('Not enough photos to create collages');
      return [];
    }

    const photoGroups: string[][] = [];
    for (let i = 0; i < selectedPhotos.length; i += 2) {
      const group = selectedPhotos.slice(i, i + 2);
      if (group.length === 2) {
        photoGroups.push(group);
      }
    }

    const collages: string[] = [];

    const collagesDir = path.join(config.uploadsDir, 'properties', 'photos', 'collages', propertyId.toString());
    await fs.mkdir(collagesDir, { recursive: true });

    for (let i = 0; i < photoGroups.length; i++) {
      const group = photoGroups[i];
      const collagePath = await this.createSingleCollage(group, propertyId, i + 1);
      if (collagePath) {
        collages.push(collagePath);
      }
    }

    logger.info(`Created ${collages.length} collages for property ${propertyId}`);
    return collages;
  }

  /**
   * Группирует фотографии по категориям
   */
  private groupPhotosByCategory(photos: Array<{url: string, category?: string}>): Map<string, string[]> {
    const grouped = new Map<string, string[]>();
    
    for (const photo of photos) {
      const category = photo.category || 'general';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(photo.url);
    }
    
    return grouped;
  }

  /**
   * Выбирает фотографии из разных категорий
   */
  private selectPhotosFromCategories(categorized: Map<string, string[]>, maxPhotos: number): string[] {
    const selected: string[] = [];
    const categories = Array.from(categorized.keys());
    
    if (categories.length === 0) {
      return [];
    }

    let categoryIndex = 0;
    while (selected.length < maxPhotos) {
      const category = categories[categoryIndex % categories.length];
      const photos = categorized.get(category)!;
      
      if (photos.length > 0) {
        selected.push(photos.shift()!);
      }
      
      categoryIndex++;
      
      if (Array.from(categorized.values()).every(arr => arr.length === 0)) {
        break;
      }
    }
    
    return selected;
  }

  /**
   * Создает один коллаж из 2 фотографий (вертикально)
   */
  private async createSingleCollage(
    photos: string[], 
    propertyId: number, 
    collageIndex: number
  ): Promise<string | null> {
    try {
      const { width, height, quality } = this.defaultOptions;
      const photoHeight = Math.floor(height / 2);
      const processedImages: { buffer: Buffer; metadata: sharp.Metadata }[] = [];

      for (let i = 0; i < photos.length; i++) {
        // ✅ ИСПРАВЛЕНО: правильно формируем путь к файлу
        let photoPath: string;
        
        // Убираем начальный слеш если есть
        const cleanPath = photos[i].startsWith('/') ? photos[i].substring(1) : photos[i];
        
        // Формируем полный путь
        photoPath = path.join(config.uploadsDir, '..', cleanPath);
        
        logger.info(`Processing photo ${i + 1}: ${photoPath}`);
        
        try {
          await fs.access(photoPath);

          const metadata = await sharp(photoPath).metadata();
          
          let targetWidth = width;
          let targetHeight = photoHeight;
          
          if (metadata.width && metadata.height) {
            const aspectRatio = metadata.width / metadata.height;
            
            if (aspectRatio > 1) {
              targetHeight = Math.floor(width / aspectRatio);
              if (targetHeight > photoHeight) {
                targetHeight = photoHeight;
                targetWidth = Math.floor(targetHeight * aspectRatio);
              }
            } else {
              targetWidth = Math.floor(photoHeight * aspectRatio);
              if (targetWidth > width) {
                targetWidth = width;
                targetHeight = Math.floor(targetWidth / aspectRatio);
              }
            }
          }

          const processedImage = await sharp(photoPath)
            .resize(targetWidth, targetHeight, {
              fit: 'inside',
              withoutEnlargement: false
            })
            .toBuffer();

          const processedMetadata = await sharp(processedImage).metadata();

          processedImages.push({
            buffer: processedImage,
            metadata: processedMetadata
          });

          logger.info(`Successfully processed photo ${i + 1}`);

        } catch (error) {
          logger.warn(`Failed to process photo ${photoPath}:`, error);
        }
      }

      if (processedImages.length === 0) {
        logger.warn('No images were processed successfully');
        return null;
      }

      const compositeImages = [];
      let currentY = 0;

      for (let i = 0; i < processedImages.length; i++) {
        const img = processedImages[i];
        const imgWidth = img.metadata.width || width;
        const imgHeight = img.metadata.height || photoHeight;
        
        const left = Math.floor((width - imgWidth) / 2);

        compositeImages.push({
          input: img.buffer,
          top: currentY,
          left: left
        });

        currentY += imgHeight;
      }

      const totalHeight = currentY;
      const background = sharp({
        create: {
          width,
          height: totalHeight,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      });

      const timestamp = Date.now();
      const filename = `collage_${propertyId}_${collageIndex}_${timestamp}.jpg`;
      const outputPath = path.join(
        config.uploadsDir, 
        'properties', 
        'photos',
        'collages', 
        propertyId.toString(),
        filename
      );

      await background
        .composite(compositeImages)
        .jpeg({ quality })
        .toFile(outputPath);

      // ✅ ВАЖНО: Возвращаем путь относительно uploads
      const relativePath = path.join('properties', 'photos', 'collages', propertyId.toString(), filename);
      
      logger.info(`Created collage: ${relativePath} (${width}x${totalHeight})`);
      return relativePath;

    } catch (error) {
      logger.error(`Failed to create collage for property ${propertyId}:`, error);
      return null;
    }
  }

  /**
   * Удаляет старые коллажи для объекта
   */
  async cleanupOldCollages(propertyId: number): Promise<void> {
    const collagesDir = path.join(
      config.uploadsDir, 
      'properties',
      'photos',
      'collages', 
      propertyId.toString()
    );

    try {
      await fs.access(collagesDir);
      const files = await fs.readdir(collagesDir);
      
      for (const file of files) {
        await fs.unlink(path.join(collagesDir, file));
      }
      
      logger.info(`Cleaned up old collages for property ${propertyId}`);
    } catch (error) {
      logger.debug(`No collages to cleanup for property ${propertyId}`);
    }
  }
}

export default new ImageCollageService();