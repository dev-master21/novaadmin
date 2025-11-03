// backend/src/controllers/vrPanorama.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import { imageProcessorService } from '../services/imageProcessor.service';
import fs from 'fs-extra';
import path from 'path';

class VRPanoramaController {
  // Получить все VR панорамы объекта
  async getByPropertyId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;

      const panoramas = await db.query(
        `SELECT * FROM property_vr_panoramas 
        WHERE property_id = ? 
        ORDER BY sort_order ASC`,
        [propertyId]
      );

      res.json({
        success: true,
        data: panoramas
      });
    } catch (error) {
      logger.error('Get VR panoramas error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения VR панорам'
      });
    }
  }

  // Создать VR панораму
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;
      const { location_type, location_number } = req.body;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files || Object.keys(files).length !== 6) {
        res.status(400).json({
          success: false,
          message: 'Требуется 6 изображений (front, back, left, right, top, bottom)'
        });
        return;
      }

      // Проверяем существование объекта
      const property = await db.queryOne(
        'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
        [propertyId]
      );

      if (!property) {
        res.status(404).json({
          success: false,
          message: 'Объект не найден'
        });
        return;
      }

      // Обрабатываем все 6 изображений
      console.log('🔄 Processing 6 VR panorama images...');
      const allFiles = [
        ...files.front,
        ...files.back,
        ...files.left,
        ...files.right,
        ...files.top,
        ...files.bottom
      ];
      const filePaths = allFiles.map(file => file.path);
      await imageProcessorService.processMultipleImages(filePaths);

      // Получаем следующий sort_order
      const sortOrderResult = await db.queryOne<any>(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM property_vr_panoramas WHERE property_id = ?',
        [propertyId]
      );
      const sortOrder = sortOrderResult?.next_order || 0;

      const getRelativePath = (file: Express.Multer.File): string => {
        return `/uploads/vr-panoramas/${file.filename}`;
      };

      // Сохраняем панораму в БД
      const result = await db.query(
        `INSERT INTO property_vr_panoramas 
         (property_id, location_type, location_number, front_image, back_image, left_image, right_image, top_image, bottom_image, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyId,
          location_type,
          location_number || null,
          getRelativePath(files.front[0]),
          getRelativePath(files.back[0]),
          getRelativePath(files.left[0]),
          getRelativePath(files.right[0]),
          getRelativePath(files.top[0]),
          getRelativePath(files.bottom[0]),
          sortOrder
        ]
      );

      logger.info(`VR panorama created for property ${propertyId}`);

      res.status(201).json({
        success: true,
        message: 'VR панорама успешно создана',
        data: { panoramaId: (result as any)[0].insertId }
      });
    } catch (error) {
      logger.error('Create VR panorama error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания VR панорамы'
      });
    }
  }

  // Удалить VR панораму
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { panoramaId } = req.params;

      const panorama = await db.queryOne<any>(
        'SELECT * FROM property_vr_panoramas WHERE id = ?',
        [panoramaId]
      );

      if (!panorama) {
        res.status(404).json({
          success: false,
          message: 'VR панорама не найдена'
        });
        return;
      }

      // Удаляем файлы
      const uploadsBase = path.join(process.cwd(), '../../../novaestate.company/backend');
      const images = [
        panorama.front_image,
        panorama.back_image,
        panorama.left_image,
        panorama.right_image,
        panorama.top_image,
        panorama.bottom_image
      ];

      for (const imagePath of images) {
        const fullPath = path.join(uploadsBase, imagePath);
        const thumbnailPath = fullPath.replace(/(\.[^.]+)$/, '_thumb$1');
        
        await fs.remove(fullPath).catch(() => {});
        await fs.remove(thumbnailPath).catch(() => {});
      }

      // Удаляем из БД
      await db.query('DELETE FROM property_vr_panoramas WHERE id = ?', [panoramaId]);

      logger.info(`VR panorama deleted: ${panoramaId}`);

      res.json({
        success: true,
        message: 'VR панорама удалена'
      });
    } catch (error) {
      logger.error('Delete VR panorama error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления VR панорамы'
      });
    }
  }

  // Обновить порядок VR панорам
  async updateOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;
      const { panoramas } = req.body; // Array of { id, sort_order }

      if (!panoramas || !Array.isArray(panoramas)) {
        res.status(400).json({
          success: false,
          message: 'Неверный формат данных'
        });
        return;
      }

      for (const panorama of panoramas) {
        await db.query(
          'UPDATE property_vr_panoramas SET sort_order = ? WHERE id = ? AND property_id = ?',
          [panorama.sort_order, panorama.id, propertyId]
        );
      }

      res.json({
        success: true,
        message: 'Порядок VR панорам обновлен'
      });
    } catch (error) {
      logger.error('Update VR panoramas order error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления порядка'
      });
    }
  }
}

export default new VRPanoramaController();