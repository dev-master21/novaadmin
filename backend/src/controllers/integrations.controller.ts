// backend/src/controllers/integrations.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import beds24Service from '../services/beds24.service';

class IntegrationsController {
  /**
   * Получить все интеграции текущего пользователя
   * GET /api/integrations
   */
  async getIntegrations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.admin?.id;

      const integrations = await db.query<any>(
        `SELECT 
          id,
          integration_type,
          is_active,
          is_verified,
          last_verified_at,
          last_sync_at,
          sync_error,
          settings_json,
          created_at,
          updated_at
        FROM integration_settings
        WHERE user_id = ?`,
        [userId]
      );

      res.json({
        success: true,
        data: integrations
      });
    } catch (error) {
      logger.error('Get integrations error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения списка интеграций'
      });
    }
  }

  /**
   * Получить настройки конкретной интеграции
   * GET /api/integrations/:type
   */
  async getIntegration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.admin?.id;
      const { type } = req.params;

      const integration = await db.queryOne<any>(
        `SELECT 
          id,
          integration_type,
          api_key_v1,
          api_key_v2,
          is_active,
          is_verified,
          last_verified_at,
          last_sync_at,
          sync_error,
          settings_json,
          created_at,
          updated_at
        FROM integration_settings
        WHERE user_id = ? AND integration_type = ?`,
        [userId, type]
      );

      if (!integration) {
        res.status(404).json({
          success: false,
          message: 'Интеграция не найдена'
        });
        return;
      }

      res.json({
        success: true,
        data: integration
      });
    } catch (error) {
      logger.error('Get integration error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения настроек интеграции'
      });
    }
  }

  /**
   * Сохранить или обновить настройки интеграции
   * POST /api/integrations/:type
   */
  async saveIntegration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.admin?.id;
      const { type } = req.params;
      const { api_key_v1, api_key_v2, settings_json } = req.body;

      if (!api_key_v1) {
        res.status(400).json({
          success: false,
          message: 'API ключ V1 обязателен'
        });
        return;
      }

      // Проверяем существующую интеграцию
      const existing = await db.queryOne<any>(
        'SELECT id FROM integration_settings WHERE user_id = ? AND integration_type = ?',
        [userId, type]
      );

      if (existing) {
        // Обновляем существующую
        await db.query(
          `UPDATE integration_settings 
          SET api_key_v1 = ?, api_key_v2 = ?, settings_json = ?, is_verified = 0, updated_at = NOW()
          WHERE id = ?`,
          [api_key_v1, api_key_v2 || null, settings_json ? JSON.stringify(settings_json) : null, existing.id]
        );

        logger.info(`Integration ${type} updated for user ${userId}`);

        res.json({
          success: true,
          message: 'Настройки интеграции обновлены',
          data: { id: existing.id }
        });
      } else {
        // Создаем новую
        const result = await db.query(
          `INSERT INTO integration_settings 
          (user_id, integration_type, api_key_v1, api_key_v2, settings_json)
          VALUES (?, ?, ?, ?, ?)`,
          [userId, type, api_key_v1, api_key_v2 || null, settings_json ? JSON.stringify(settings_json) : null]
        );

        const insertId = (result as any)[0].insertId;

        logger.info(`Integration ${type} created for user ${userId}`);

        res.status(201).json({
          success: true,
          message: 'Интеграция создана',
          data: { id: insertId }
        });
      }
    } catch (error) {
      logger.error('Save integration error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сохранения настроек интеграции'
      });
    }
  }

  /**
   * Проверить валидность API ключей Beds24
   * POST /api/integrations/beds24/verify
   */
  async verifyBeds24(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.admin?.id;
      const { api_key_v1 } = req.body;

      if (!api_key_v1) {
        res.status(400).json({
          success: false,
          message: 'API ключ V1 обязателен'
        });
        return;
      }

      // Проверяем ключ через Beds24 API
      const verificationResult = await beds24Service.verifyApiKey(api_key_v1);

      if (verificationResult.success) {
        // Обновляем статус верификации в БД
        await db.query(
          `UPDATE integration_settings 
          SET is_verified = 1, last_verified_at = NOW(), sync_error = NULL
          WHERE user_id = ? AND integration_type = 'beds24'`,
          [userId]
        );

        logger.info(`Beds24 API key verified for user ${userId}`);

        res.json({
          success: true,
          message: 'API ключ успешно проверен и действителен'
        });
      } else {
        // Обновляем статус ошибки в БД
        await db.query(
          `UPDATE integration_settings 
          SET is_verified = 0, sync_error = ?
          WHERE user_id = ? AND integration_type = 'beds24'`,
          [verificationResult.message, userId]
        );

        res.status(400).json({
          success: false,
          message: verificationResult.message || 'Не удалось проверить API ключ'
        });
      }
    } catch (error) {
      logger.error('Verify Beds24 error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при проверке API ключа'
      });
    }
  }

/**
 * Получить список объектов из Beds24 с rooms
 * GET /api/integrations/beds24/properties
 */
async getBeds24Properties(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.admin?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Пользователь не авторизован'
      });
      return;
    }

    // Получаем интеграцию пользователя
    const integration = await db.queryOne<any>(
      'SELECT * FROM integration_settings WHERE user_id = ? AND integration_type = ?',
      [userId, 'beds24']
    );

    if (!integration || !integration.is_verified) {
      res.status(400).json({
        success: false,
        message: 'Интеграция Beds24 не настроена или не верифицирована'
      });
      return;
    }

    const apiKey = integration.api_key_v1;

    // ✅ Используем новый оптимизированный метод
    logger.info('Fetching Beds24 properties with rooms (optimized request queue)...');
    const result = await beds24Service.getPropertiesWithRooms(apiKey);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message || 'Ошибка получения объектов из Beds24'
      });
      return;
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Get Beds24 properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
}

/**
 * Получить список объектов из нашей БД для синхронизации
 * GET /api/integrations/beds24/my-properties
 */
async getMyProperties(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.admin?.id;
    const isSuperAdmin = req.admin?.is_super_admin;

    let query = `
      SELECT 
        p.id,
        p.property_number,
        p.property_type,
        p.region,
        p.bedrooms,
        p.bathrooms,
        p.deal_type,
        p.beds24_prop_id,
        p.beds24_room_id,
        p.created_by,
        pt.property_name,
        (SELECT photo_url FROM property_photos WHERE property_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) as cover_photo,
        COALESCE(au.full_name, 'Система') as creator_name
      FROM properties p
      LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'ru'
      LEFT JOIN admin_users au ON p.created_by = au.id
      WHERE p.deleted_at IS NULL AND p.status != 'archived'
    `;

    const params: any[] = [];

    if (!isSuperAdmin) {
      query += ' AND p.created_by = ?';
      params.push(userId);
    }

    query += ' ORDER BY p.created_at DESC';

    const properties = await db.query<any>(query, params);

    // ✅ ИСПРАВЛЕНО: Правильный путь к фото
    const propertiesWithUrls = properties.map((property: any) => {
      let photoUrl = null;
      
      if (property.cover_photo) {
        // Убираем возможные дублирующиеся пути
        let cleanPath = property.cover_photo;
        
        // Если уже есть полный URL - используем как есть
        if (cleanPath.startsWith('http')) {
          photoUrl = cleanPath;
        } else {
          // Убираем начальный слеш если есть
          cleanPath = cleanPath.replace(/^\//, '');
          
          // Убираем /uploads/properties/photos/ если есть в начале
          cleanPath = cleanPath.replace(/^uploads\/properties\/photos\//, '');
          
          // Добавляем _thumb перед расширением если его нет
          if (!cleanPath.includes('_thumb')) {
            cleanPath = cleanPath.replace(/(\.[^.]+)$/, '_thumb$1');
          }
          
          photoUrl = `https://novaestate.company/uploads/properties/photos/${cleanPath}`;
        }
      }

      return {
        ...property,
        cover_photo: photoUrl,
        is_synced: !!(property.beds24_prop_id && property.beds24_room_id),
        bedrooms: property.bedrooms ? Math.round(property.bedrooms) : 0,
        bathrooms: property.bathrooms ? Math.round(property.bathrooms) : 0
      };
    });

    res.json({
      success: true,
      data: propertiesWithUrls
    });
  } catch (error) {
    logger.error('Get my properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка объектов'
    });
  }
}

  /**
   * Привязать объект из нашей БД к room из Beds24
   * POST /api/integrations/beds24/link
   */
  async linkBeds24Property(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.admin?.id;
      const isSuperAdmin = req.admin?.is_super_admin;
      const { property_id, beds24_prop_id, beds24_room_id } = req.body;

      if (!property_id || !beds24_prop_id || !beds24_room_id) {
        res.status(400).json({
          success: false,
          message: 'Не указаны обязательные параметры'
        });
        return;
      }

      // Проверяем что объект существует
      const property = await db.queryOne<any>(
        'SELECT id, created_by FROM properties WHERE id = ? AND deleted_at IS NULL',
        [property_id]
      );

      if (!property) {
        res.status(404).json({
          success: false,
          message: 'Объект не найден'
        });
        return;
      }

      // Проверяем права доступа
      if (!isSuperAdmin && property.created_by !== userId) {
        res.status(403).json({
          success: false,
          message: 'У вас нет прав для изменения этого объекта'
        });
        return;
      }

      // Проверяем что room еще не привязан к другому объекту
      const existingLink = await db.queryOne<any>(
        'SELECT id, property_number FROM properties WHERE beds24_room_id = ? AND id != ? AND deleted_at IS NULL',
        [beds24_room_id, property_id]
      );

      if (existingLink) {
        res.status(400).json({
          success: false,
          message: `Этот room уже привязан к объекту ${existingLink.property_number}`
        });
        return;
      }

      // Привязываем объект к room
      await db.query(
        'UPDATE properties SET beds24_prop_id = ?, beds24_room_id = ?, updated_at = NOW() WHERE id = ?',
        [beds24_prop_id, beds24_room_id, property_id]
      );

      // Обновляем время последней синхронизации
      await db.query(
        'UPDATE integration_settings SET last_sync_at = NOW() WHERE user_id = ? AND integration_type = ?',
        [userId, 'beds24']
      );

      logger.info(`Property ${property_id} linked to Beds24 room ${beds24_room_id} by user ${userId}`);

      res.json({
        success: true,
        message: 'Объект успешно привязан к Beds24'
      });
    } catch (error) {
      logger.error('Link Beds24 property error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при привязке объекта'
      });
    }
  }

  /**
   * Отвязать объект от Beds24
   * DELETE /api/integrations/beds24/unlink/:propertyId
   */
  async unlinkBeds24Property(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.admin?.id;
      const isSuperAdmin = req.admin?.is_super_admin;
      const { propertyId } = req.params;

      // Проверяем что объект существует
      const property = await db.queryOne<any>(
        'SELECT id, created_by FROM properties WHERE id = ? AND deleted_at IS NULL',
        [propertyId]
      );

      if (!property) {
        res.status(404).json({
          success: false,
          message: 'Объект не найден'
        });
        return;
      }

      // Проверяем права доступа
      if (!isSuperAdmin && property.created_by !== userId) {
        res.status(403).json({
          success: false,
          message: 'У вас нет прав для изменения этого объекта'
        });
        return;
      }

      // Отвязываем объект
      await db.query(
        'UPDATE properties SET beds24_prop_id = NULL, beds24_room_id = NULL, updated_at = NOW() WHERE id = ?',
        [propertyId]
      );

      logger.info(`Property ${propertyId} unlinked from Beds24 by user ${userId}`);

      res.json({
        success: true,
        message: 'Объект отвязан от Beds24'
      });
    } catch (error) {
      logger.error('Unlink Beds24 property error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при отвязке объекта'
      });
    }
  }

  /**
   * Удалить интеграцию
   * DELETE /api/integrations/:type
   */
  async deleteIntegration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.admin?.id;
      const { type } = req.params;

      // Проверяем существование интеграции
      const integration = await db.queryOne<any>(
        'SELECT id FROM integration_settings WHERE user_id = ? AND integration_type = ?',
        [userId, type]
      );

      if (!integration) {
        res.status(404).json({
          success: false,
          message: 'Интеграция не найдена'
        });
        return;
      }

      // Удаляем интеграцию
      await db.query(
        'DELETE FROM integration_settings WHERE id = ?',
        [integration.id]
      );

      // Если это Beds24 - отвязываем все объекты пользователя
      if (type === 'beds24') {
        await db.query(
          'UPDATE properties SET beds24_prop_id = NULL, beds24_room_id = NULL WHERE created_by = ?',
          [userId]
        );
      }

      logger.info(`Integration ${type} deleted for user ${userId}`);

      res.json({
        success: true,
        message: 'Интеграция удалена'
      });
    } catch (error) {
      logger.error('Delete integration error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при удалении интеграции'
      });
    }
  }
}

export default new IntegrationsController();