// backend/src/controllers/properties.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import { imageProcessorService } from '../services/imageProcessor.service';
import fs from 'fs-extra';
import path from 'path';
import { getImageUrl } from '../utils/imageUrl';

class PropertiesController {
/**
 * Получить список всех объектов с информацией о создателе
 * GET /api/properties
 */
async getAll(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      deal_type, 
      property_type,
      search,
      owner_name  // ✅ ДОБАВЛЕНО: новый параметр фильтрации
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;
    
    const whereConditions: string[] = ['p.deleted_at IS NULL'];
    const queryParams: any[] = [];

    if (status) {
      whereConditions.push('p.status = ?');
      queryParams.push(status);
    }

    if (deal_type) {
      whereConditions.push('p.deal_type = ?');
      queryParams.push(deal_type);
    }

    if (property_type) {
      whereConditions.push('p.property_type = ?');
      queryParams.push(property_type);
    }

    // ✅ ДОБАВЛЕНО: фильтр по owner_name
    if (owner_name) {
      whereConditions.push('p.owner_name = ?');
      queryParams.push(owner_name);
    }

    if (search) {
      whereConditions.push('(p.property_number LIKE ? OR pt.property_name LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM properties p
      LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'ru'
      ${whereClause}
    `;
    
    const countResult = await db.queryOne<any>(countQuery, queryParams);
    const total = countResult?.total || 0;

    const query = `
      SELECT 
        p.id,
        p.property_number,
        p.deal_type,
        p.property_type,
        p.region,
        p.bedrooms,
        p.bathrooms,
        p.sale_price,
        p.status,
        p.created_at,
        p.updated_at,
        p.created_by,
        p.owner_name,
        p.owner_phone,
        p.owner_email,
        p.owner_telegram,
        p.owner_instagram,
        p.owner_notes,
        COALESCE(au.full_name, 'Система') as creator_name,
        COALESCE(au.username, 'system') as creator_username,
        pt.property_name,
        (SELECT photo_url FROM property_photos WHERE property_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) as cover_photo
      FROM properties p
      LEFT JOIN admin_users au ON p.created_by = au.id
      LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'ru'
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    // ✅ ИСПРАВЛЕНО: заменили [] на queryParams
    const properties = await db.query<any>(query, queryParams);

    // Преобразуем cover_photo в полный URL с thumbnail
    const propertiesWithUrls = properties.map((property: any) => ({
      ...property,
      cover_photo: getImageUrl(property.cover_photo, true) // используем thumbnail
    }));

    res.json({
      success: true,
      data: {
        properties: propertiesWithUrls,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения списка объектов'
    });
  }
}

/**
 * Получить список уникальных владельцев (источников)
 * GET /api/properties/owners/unique
 */
async getUniqueOwners(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const owners = await db.query<any>(
      `SELECT DISTINCT owner_name
       FROM properties
       WHERE owner_name IS NOT NULL 
       AND owner_name != ''
       AND deleted_at IS NULL
       ORDER BY owner_name ASC`
    );

    const ownersList = owners.map((o: any) => o.owner_name);

    res.json({
      success: true,
      data: ownersList
    });
  } catch (error) {
    logger.error('Get unique owners error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения списка владельцев'
    });
  }
}
/**
 * Скачать архив фотографий
 * POST /api/properties/:id/photos/download
 */
async downloadPhotos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { photoIds } = req.body; // массив ID фотографий для скачивания

    // Проверяем существование объекта
    const property = await db.queryOne<any>(
      'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Получаем фотографии
    let photos;
    if (photoIds && photoIds.length > 0) {
      // Скачиваем выбранные фотографии
      const placeholders = photoIds.map(() => '?').join(',');
      photos = await db.query<any>(
        `SELECT id, photo_url, category FROM property_photos 
         WHERE property_id = ? AND id IN (${placeholders})`,
        [id, ...photoIds]
      );
    } else {
      // Скачиваем все фотографии
      photos = await db.query<any>(
        'SELECT id, photo_url, category FROM property_photos WHERE property_id = ?',
        [id]
      );
    }

    if (photos.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Фотографии не найдены'
      });
      return;
    }

    // Если одна фотография - отправляем напрямую
    if (photos.length === 1) {
      const photo = photos[0];
      const filePath = path.join('/var/www/www-root/data/www/novaestate.company/backend', photo.photo_url);
      
      if (await fs.pathExists(filePath)) {
        res.download(filePath, `property_${id}_photo_${photo.id}.jpg`);
      } else {
        res.status(404).json({
          success: false,
          message: 'Файл не найден'
        });
      }
      return;
    }

    // Создаем ZIP архив для нескольких фотографий
    const archiver = require('archiver');
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const filename = photoIds && photoIds.length > 0 
      ? `property_${id}_selected_photos.zip`
      : `property_${id}_all_photos.zip`;

    res.attachment(filename);
    archive.pipe(res);

    // Добавляем файлы в архив
    for (const photo of photos) {
      const filePath = path.join('/var/www/www-root/data/www/novaestate.company/backend', photo.photo_url);
      
      if (await fs.pathExists(filePath)) {
        const fileName = `${photo.category}_${photo.id}.jpg`;
        archive.file(filePath, { name: fileName });
      }
    }

    await archive.finalize();

    logger.info(`Downloaded ${photos.length} photos for property ${id}`);

  } catch (error) {
    logger.error('Download photos error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка скачивания фотографий'
    });
  }
}
/**
 * Получить объект по ID
 * GET /api/properties/:id
 */
async getById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const property = await db.queryOne<any>(
      `SELECT 
        p.*,
        COALESCE(au.full_name, 'Система') as creator_name,
        COALESCE(au.username, 'system') as creator_username
      FROM properties p
      LEFT JOIN admin_users au ON p.created_by = au.id
      WHERE p.id = ? AND p.deleted_at IS NULL`,
      [id]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Загружаем переводы
    const translations = await db.query(
      'SELECT language_code, property_name, description FROM property_translations WHERE property_id = ?',
      [id]
    );

    // Загружаем фотографии
    const photos = await db.query(
      'SELECT * FROM property_photos WHERE property_id = ? ORDER BY sort_order ASC',
      [id]
    );

    // Загружаем особенности
    const features = await db.query(
      'SELECT * FROM property_features WHERE property_id = ?',
      [id]
    );

    // Загружаем ценообразование
    const pricing = await db.query(
      'SELECT * FROM property_pricing WHERE property_id = ? ORDER BY start_date_recurring ASC',
      [id]
    );

    // Загружаем VR панорамы
    const vrPanoramas = await db.query(
      'SELECT * FROM property_vr_panoramas WHERE property_id = ? ORDER BY sort_order ASC',
      [id]
    );

    // Загружаем видео
    const videos = await db.query<any>(
      `SELECT id, video_url, title, description, file_size, duration, 
              mime_type, thumbnail_url, sort_order, created_at
       FROM property_videos
       WHERE property_id = ?
       ORDER BY sort_order ASC`,
      [id]
    );

    // Преобразуем все URL изображений
    const photosWithUrls = photos.map((photo: any) => ({
      ...photo,
      photo_url: getImageUrl(photo.photo_url, false), // полный размер
      photo_url_thumb: getImageUrl(photo.photo_url, true) // thumbnail
    }));

    const vrPanoramasWithUrls = vrPanoramas.map((vr: any) => ({
      ...vr,
      panorama_url: getImageUrl(vr.panorama_url, false)
    }));

    // Преобразуем URL видео
    const videosWithUrls = (videos || []).map((video: any) => ({
      ...video,
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url ? video.thumbnail_url : null
    }));

    res.json({
      success: true,
      data: {
        ...property,
        floor_plan_url: getImageUrl(property.floor_plan_url, false),
        translations,
        photos: photosWithUrls,
        features,
        pricing,
        vrPanoramas: vrPanoramasWithUrls,
        videos: videosWithUrls
      }
    });
  } catch (error) {
    logger.error('Get property by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения объекта'
    });
  }
}

  /**
   * Создать объект недвижимости
   * POST /api/properties
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();
    
    try {
      const {
        // Основная информация
        deal_type, property_type, region, address, google_maps_link,
        latitude, longitude, property_number, complex_name,
        bedrooms, bathrooms, indoor_area, outdoor_area, plot_size,
        floors, floor, penthouse_floors, construction_year, construction_month,
        furniture_status, parking_spaces, pets_allowed, pets_custom,
        building_ownership, land_ownership, ownership_type,
        sale_price, year_price, minimum_nights, ics_calendar_url, status, video_url,
        
        // Информация о владельце
        owner_name, owner_phone, owner_email, owner_telegram, owner_instagram, owner_notes,
        
        // Переводы
        translations,
        
        // Features
        renovationDates,
        
        // Сезонные цены
        seasonalPricing
      } = req.body;

      // Создаем объект
      const propertyResult = await connection.query(
        `INSERT INTO properties (
          deal_type, property_type, region, address, google_maps_link,
          latitude, longitude, property_number, complex_name,
          bedrooms, bathrooms, indoor_area, outdoor_area, plot_size,
          floors, floor, penthouse_floors, construction_year, construction_month,
          furniture_status, parking_spaces, pets_allowed, pets_custom,
          building_ownership, land_ownership, ownership_type,
          sale_price, year_price, minimum_nights, ics_calendar_url, video_url, status, created_by,
          owner_name, owner_phone, owner_email, owner_telegram, owner_instagram, owner_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deal_type, property_type, region, address, google_maps_link,
          latitude, longitude, property_number, complex_name,
          bedrooms, bathrooms, indoor_area, outdoor_area, plot_size,
          floors, floor, penthouse_floors, construction_year, construction_month,
          furniture_status, parking_spaces, pets_allowed, pets_custom,
          building_ownership, land_ownership, ownership_type,
          sale_price, year_price, minimum_nights, ics_calendar_url, video_url, status || 'draft',
          req.admin?.id,
          owner_name, owner_phone, owner_email, owner_telegram, owner_instagram, owner_notes
        ]
      );

      const propertyId = (propertyResult as any)[0].insertId;
      logger.info(`Property created: ${propertyId} by user ${req.admin?.username}`);

      // Добавляем переводы
      if (translations && Object.keys(translations).length > 0) {
        for (const [lang, data] of Object.entries(translations)) {
          const translationData = data as { property_name?: string; description?: string };
          if (translationData.property_name || translationData.description) {
            await connection.query(
              `INSERT INTO property_translations (property_id, language_code, property_name, description)
               VALUES (?, ?, ?, ?)`,
              [propertyId, lang, translationData.property_name || null, translationData.description || null]
            );
          }
        }
      }

      // Добавляем features
      const featureTypes: { [key: string]: string } = {
        propertyFeatures: 'property',
        outdoorFeatures: 'outdoor',
        rentalFeatures: 'rental',
        locationFeatures: 'location',
        views: 'view'
      };

      for (const [key, type] of Object.entries(featureTypes)) {
        const featuresArray = req.body[key];
        if (featuresArray && Array.isArray(featuresArray) && featuresArray.length > 0) {
          for (const feature of featuresArray) {
            const renovationDate = renovationDates?.[feature] || null;
            await connection.query(
              `INSERT INTO property_features (property_id, feature_type, feature_value, renovation_date)
               VALUES (?, ?, ?, ?)`,
              [propertyId, type, feature, renovationDate]
            );
          }
        }
      }

      // Добавляем сезонные цены
      if (seasonalPricing && Array.isArray(seasonalPricing) && seasonalPricing.length > 0) {
        for (const price of seasonalPricing) {
          await connection.query(
            `INSERT INTO property_pricing (property_id, season_type, start_date_recurring, end_date_recurring, price_per_night, source_price_per_night, minimum_nights)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              propertyId,
              price.season_type || null,
              price.start_date_recurring,
              price.end_date_recurring,
              price.price_per_night,
              price.source_price_per_night || null,
              price.minimum_nights || null
            ]
          );
        }
      }

      await db.commit(connection);

      res.status(201).json({
        success: true,
        message: 'Объект успешно создан',
        data: { propertyId }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Create property error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания объекта'
      });
    }
  }

/**
 * Обновить объект недвижимости
 * PUT /api/properties/:id
 */
async update(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();
  
  try {
    const { id } = req.params;
    const {
      // Основная информация
      deal_type, property_type, region, address, google_maps_link,
      latitude, longitude, property_number, complex_name,
      bedrooms, bathrooms, indoor_area, outdoor_area, plot_size,
      floors, floor, penthouse_floors, construction_year, construction_month,
      furniture_status, parking_spaces, pets_allowed, pets_custom,
      building_ownership, land_ownership, ownership_type,
      sale_price, year_price, minimum_nights, ics_calendar_url, status, video_url,
      
      // Информация о владельце
      owner_name, owner_phone, owner_email, owner_telegram, owner_instagram, owner_notes,
      
      // Переводы
      translations,
      
      // Features
      renovationDates,
      
      // Комиссии
      sale_commission_type, sale_commission_value,
      rent_commission_type, rent_commission_value,
      
      // Реновация
      renovation_type, renovation_date,
      
      // Сезонные цены
      seasonalPricing,
      
      // ✅ ИГНОРИРУЕМ videos - они обрабатываются отдельно через другой endpoint
      // videos - не используется здесь
    } = req.body;

    // ✅ ИСПРАВЛЕНО: используем query вместо queryOne
    const existingPropertyResult: any = await connection.query(
      'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    const existingProperty = Array.isArray(existingPropertyResult[0]) 
      ? existingPropertyResult[0][0] 
      : existingPropertyResult[0];

    if (!existingProperty) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Обновляем основную информацию
    await connection.query(
      `UPDATE properties SET
        deal_type = ?, property_type = ?, region = ?, address = ?, google_maps_link = ?,
        latitude = ?, longitude = ?, property_number = ?, complex_name = ?,
        bedrooms = ?, bathrooms = ?, indoor_area = ?, outdoor_area = ?, plot_size = ?,
        floors = ?, floor = ?, penthouse_floors = ?, construction_year = ?, construction_month = ?,
        furniture_status = ?, parking_spaces = ?, pets_allowed = ?, pets_custom = ?,
        building_ownership = ?, land_ownership = ?, ownership_type = ?,
        sale_price = ?, year_price = ?, minimum_nights = ?, ics_calendar_url = ?, video_url = ?, status = ?,
        owner_name = ?, owner_phone = ?, owner_email = ?, owner_telegram = ?, owner_instagram = ?, owner_notes = ?,
        sale_commission_type = ?, sale_commission_value = ?,
        rent_commission_type = ?, rent_commission_value = ?,
        renovation_type = ?, renovation_date = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        deal_type, property_type, region, address, google_maps_link,
        latitude, longitude, property_number, complex_name,
        bedrooms, bathrooms, indoor_area, outdoor_area, plot_size,
        floors, floor, penthouse_floors, construction_year, construction_month,
        furniture_status, parking_spaces, pets_allowed, pets_custom,
        building_ownership, land_ownership, ownership_type,
        sale_price, year_price, minimum_nights, ics_calendar_url, video_url, status || 'draft',
        owner_name, owner_phone, owner_email, owner_telegram, owner_instagram, owner_notes,
        sale_commission_type, sale_commission_value,
        rent_commission_type, rent_commission_value,
        renovation_type, renovation_date,
        id
      ]
    );

    // Обновляем переводы
    if (translations && Object.keys(translations).length > 0) {
      // Удаляем старые переводы
      await connection.query('DELETE FROM property_translations WHERE property_id = ?', [id]);

      // Добавляем новые переводы
      for (const [lang, data] of Object.entries(translations)) {
        const translationData = data as { property_name?: string; description?: string };
        if (translationData.property_name || translationData.description) {
          await connection.query(
            `INSERT INTO property_translations (property_id, language_code, property_name, description)
             VALUES (?, ?, ?, ?)`,
            [id, lang, translationData.property_name || null, translationData.description || null]
          );
        }
      }
    }

    // Обновляем features
    await connection.query('DELETE FROM property_features WHERE property_id = ?', [id]);

    const featureTypes: { [key: string]: string } = {
      propertyFeatures: 'property',
      outdoorFeatures: 'outdoor',
      rentalFeatures: 'rental',
      locationFeatures: 'location',
      views: 'view'
    };

    for (const [key, type] of Object.entries(featureTypes)) {
      const featuresArray = req.body[key];
      if (featuresArray && Array.isArray(featuresArray) && featuresArray.length > 0) {
        for (const feature of featuresArray) {
          const renovationDate = renovationDates?.[feature] || null;
          await connection.query(
            `INSERT INTO property_features (property_id, feature_type, feature_value, renovation_date)
             VALUES (?, ?, ?, ?)`,
            [id, type, feature, renovationDate]
          );
        }
      }
    }

    // Обновляем сезонные цены
    if (seasonalPricing !== undefined) {
      // Удаляем старые цены
      await connection.query('DELETE FROM property_pricing WHERE property_id = ?', [id]);

      // Добавляем новые цены
      if (Array.isArray(seasonalPricing) && seasonalPricing.length > 0) {
        for (const price of seasonalPricing) {
          await connection.query(
            `INSERT INTO property_pricing (property_id, season_type, start_date_recurring, end_date_recurring, price_per_night, source_price_per_night, minimum_nights)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              price.season_type || 'custom',
              price.start_date_recurring,
              price.end_date_recurring,
              price.price_per_night,
              price.source_price_per_night || null,
              price.minimum_nights || null
            ]
          );
        }
      }
    }

    await connection.commit();
    logger.info(`Property updated: ${id} by user ${req.admin?.username}`);

    res.json({
      success: true,
      message: 'Объект успешно обновлен'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Update property error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления объекта'
    });
  }
}

  /**
   * Мягкое удаление объекта (скрытие)
   * DELETE /api/properties/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const property = await db.queryOne(
        'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!property) {
        res.status(404).json({
          success: false,
          message: 'Объект не найден'
        });
        return;
      }

      await db.query(
        'UPDATE properties SET deleted_at = NOW() WHERE id = ?',
        [id]
      );

      logger.info(`Property soft deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Объект успешно удален'
      });
    } catch (error) {
      logger.error('Delete property error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления объекта'
      });
    }
  }

  /**
   * Восстановить удаленный объект
   * POST /api/properties/:id/restore
   */
  async restore(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const property = await db.queryOne(
        'SELECT id FROM properties WHERE id = ? AND deleted_at IS NOT NULL',
        [id]
      );

      if (!property) {
        res.status(404).json({
          success: false,
          message: 'Объект не найден'
        });
        return;
      }

      await db.query(
        'UPDATE properties SET deleted_at = NULL WHERE id = ?',
        [id]
      );

      logger.info(`Property restored: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Объект успешно восстановлен'
      });
    } catch (error) {
      logger.error('Restore property error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка восстановления объекта'
      });
    }
  }

  /**
   * Изменить видимость объекта на сайте
   * PATCH /api/properties/:id/visibility
   */
  async toggleVisibility(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['published', 'draft', 'hidden'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Неверный статус. Допустимые значения: published, draft, hidden'
        });
        return;
      }

      await db.query(
        'UPDATE properties SET status = ? WHERE id = ?',
        [status, id]
      );

      logger.info(`Property visibility changed: ${id} to ${status} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Видимость объекта изменена'
      });
    } catch (error) {
      logger.error('Toggle visibility error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка изменения видимости'
      });
    }
  }

/**
 * Загрузить фотографии для объекта
 * POST /api/properties/:id/photos
 */
async uploadPhotos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { category = 'general' } = req.body;
    const files = req.files as Express.Multer.File[];

    logger.info(`Upload photos request: property=${id}, category=${category}, files=${files?.length || 0}`);

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Нет файлов для загрузки'
      });
      return;
    }

    // Проверяем существование объекта
    const property = await db.queryOne(
      'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      logger.warn(`Property not found: ${id}`);
      for (const file of files) {
        await fs.remove(file.path);
      }
      
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Получаем максимальный sort_order для категории
    const maxOrder = await db.queryOne<any>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM property_photos WHERE property_id = ? AND category = ?',
      [id, category]
    );

    let currentOrder = (maxOrder?.max_order || -1) + 1;
    logger.info(`Starting sort_order: ${currentOrder}`);

    // ПАРАЛЛЕЛЬНАЯ обработка всех изображений
    logger.info(`Starting parallel processing of ${files.length} images`);
    
    const filePaths = files.map(file => file.path);
    const processedImages = await imageProcessorService.processMultipleImages(filePaths);
    
    logger.info(`Successfully processed ${processedImages.length} images`);

    // Сохраняем информацию о фотографиях в БД
    const photoIds: number[] = [];
    for (let i = 0; i < processedImages.length; i++) {
      const processed = processedImages[i];
      
      // Берем путь от /uploads включительно
      const uploadsIndex = processed.path.indexOf('uploads');
      const dbPath = uploadsIndex !== -1 
        ? '/' + processed.path.substring(uploadsIndex).replace(/\\/g, '/')
        : '/' + path.relative('/var/www/www-root/data/www/novaestate.company/backend', processed.path).replace(/\\/g, '/');

      logger.info(`Saving to DB - File: ${processed.path}, DB path: ${dbPath}`);

      try {
        const result: any = await db.query(
          `INSERT INTO property_photos (property_id, photo_url, category, sort_order, is_primary)
           VALUES (?, ?, ?, ?, ?)`,
          [id, dbPath, category, currentOrder + i, false]
        );

        let insertId: number | undefined;
        if (Array.isArray(result)) {
          insertId = result[0]?.insertId;
        } else if (result?.insertId) {
          insertId = result.insertId;
        }

        if (insertId) {
          photoIds.push(insertId);
          logger.info(`Successfully saved photo with ID: ${insertId}`);
        } else {
          logger.error(`Failed to get insertId for photo ${i + 1}`);
        }
      } catch (dbError: any) {
        logger.error(`Database error for photo ${i + 1}:`, dbError);
        throw dbError;
      }
    }

    logger.info(`Successfully uploaded and processed ${photoIds.length} photos for property ${id}`);

    res.status(201).json({
      success: true,
      message: `Загружено ${photoIds.length} фото`,
      data: { photoIds, count: photoIds.length }
    });

  } catch (error: any) {
    logger.error('Upload photos error:', error);
    
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      for (const file of files) {
        try {
          await fs.remove(file.path);
        } catch (e) {
          logger.error('Failed to remove file:', e);
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки фотографий'
    });
  }
}

/**
 * Удаление фотографии
 * DELETE /api/properties/photos/:photoId
 */
async deletePhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id, photoId } = req.params;

    const photo = await db.queryOne<any>(
      'SELECT photo_url FROM property_photos WHERE id = ? AND property_id = ?',
      [photoId, id]
    );

    if (!photo) {
      res.status(404).json({
        success: false,
        message: 'Фотография не найдена'
      });
      return;
    }

    // Удаляем из БД
    await db.query('DELETE FROM property_photos WHERE id = ?', [photoId]);

    // Удаляем файл и thumbnail через сервис
    const filePath = path.join(process.cwd(), 'public', photo.photo_url);
    await imageProcessorService.deleteImage(filePath);

    logger.info(`Photo deleted: ${photoId} for property ${id}`);

    res.json({
      success: true,
      message: 'Фотография удалена'
    });
  } catch (error) {
    logger.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления фотографии'
    });
  }
}

/**
 * Обновить порядок фотографий и категории
 * PUT /api/properties/:id/photos/reorder
 */
async updatePhotosOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат данных'
      });
      return;
    }

    // Обновляем каждое фото
    for (const update of updates) {
      await db.query(
        'UPDATE property_photos SET sort_order = ?, category = ? WHERE id = ? AND property_id = ?',
        [update.sort_order, update.category, update.id, id]
      );
    }

    logger.info(`Photos order updated for property ${id}`);

    res.json({
      success: true,
      message: 'Порядок фотографий обновлен'
    });
  } catch (error) {
    logger.error('Update photos order error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления порядка'
    });
  }
}

/**
 * Установить главную фотографию
 * PATCH /api/properties/photos/:photoId/primary
 */
async setPrimaryPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { photoId } = req.params;

    const photo = await db.queryOne<any>(
      'SELECT property_id FROM property_photos WHERE id = ?',
      [photoId]
    );

    if (!photo) {
      res.status(404).json({
        success: false,
        message: 'Фотография не найдена'
      });
      return;
    }

    // Сбрасываем все is_primary для этого объекта
    await db.query(
      'UPDATE property_photos SET is_primary = FALSE WHERE property_id = ?',
      [photo.property_id]
    );

    // Устанавливаем новую главную
    await db.query(
      'UPDATE property_photos SET is_primary = TRUE WHERE id = ?',
      [photoId]
    );

    logger.info(`Primary photo set: ${photoId}`);

    res.json({
      success: true,
      message: 'Главная фотография установлена'
    });
  } catch (error) {
    logger.error('Set primary photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка установки главной фотографии'
    });
  }
}

/**
 * Загрузка планировки
 * POST /api/properties/:id/floor-plan
 */
async uploadFloorPlan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: 'Файл не загружен'
      });
      return;
    }

    // Проверяем существование объекта
    const property = await db.queryOne(
      'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Обрабатываем изображение
    await imageProcessorService.processImage(file.path);

    const relativePath = `/uploads/properties/floor-plans/${file.filename}`;

    await db.query(
      'UPDATE properties SET floor_plan_url = ? WHERE id = ?',
      [relativePath, id]
    );

    logger.info(`Floor plan uploaded for property ${id}`);

    res.json({
      success: true,
      message: 'Планировка загружена',
      data: { url: relativePath }
    });
  } catch (error) {
    logger.error('Upload floor plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки планировки'
    });
  }
}
/**
 * Получить VR панорамы
 * GET /api/properties/:id/vr-panoramas
 */
async getVRPanoramas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const panoramas = await db.query(
      'SELECT * FROM property_vr_panoramas WHERE property_id = ? ORDER BY sort_order ASC',
      [id]
    );

    const panoramasWithUrls = panoramas.map((vr: any) => ({
      ...vr,
      front_image: getImageUrl(vr.front_image, false),
      back_image: getImageUrl(vr.back_image, false),
      left_image: getImageUrl(vr.left_image, false),
      right_image: getImageUrl(vr.right_image, false),
      top_image: getImageUrl(vr.top_image, false),
      bottom_image: getImageUrl(vr.bottom_image, false)
    }));

    res.json({
      success: true,
      data: panoramasWithUrls
    });
  } catch (error) {
    logger.error('Get VR panoramas error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения VR панорам'
    });
  }
}

/**
 * Создать VR панораму
 * POST /api/properties/:id/vr-panoramas
 */
async createVRPanorama(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { location_type, location_number } = req.body;
    const files = req.files as any;

    if (!files || !files.front || !files.back || !files.left || !files.right || !files.top || !files.bottom) {
      res.status(400).json({
        success: false,
        message: 'Необходимо загрузить все 6 изображений'
      });
      return;
    }

    // Проверяем существование объекта
    const property = await db.queryOne(
      'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Обрабатываем изображения
    const directions = ['front', 'back', 'left', 'right', 'top', 'bottom'];
    for (const dir of directions) {
      await imageProcessorService.processImage(files[dir][0].path);
    }

    // Получаем максимальный sort_order
    const maxSortResult = await db.queryOne<any>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM property_vr_panoramas WHERE property_id = ?',
      [id]
    );
    const sortOrder = maxSortResult?.next_order || 0;

    await db.query(
      `INSERT INTO property_vr_panoramas (
        property_id, location_type, location_number,
        front_image, back_image, left_image, right_image, top_image, bottom_image,
        sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, location_type, location_number || null,
        `/uploads/properties/vr/${files.front[0].filename}`,
        `/uploads/properties/vr/${files.back[0].filename}`,
        `/uploads/properties/vr/${files.left[0].filename}`,
        `/uploads/properties/vr/${files.right[0].filename}`,
        `/uploads/properties/vr/${files.top[0].filename}`,
        `/uploads/properties/vr/${files.bottom[0].filename}`,
        sortOrder
      ]
    );

    logger.info(`VR panorama created for property ${id}`);

    res.json({
      success: true,
      message: 'VR панорама создана'
    });
  } catch (error) {
    logger.error('Create VR panorama error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания VR панорамы'
    });
  }
}

/**
 * Удалить VR панораму
 * DELETE /api/properties/vr-panoramas/:panoramaId
 */
async deleteVRPanorama(req: AuthRequest, res: Response): Promise<void> {
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
    const directions = ['front_image', 'back_image', 'left_image', 'right_image', 'top_image', 'bottom_image'];
    
    for (const dir of directions) {
      const imagePath = path.join(uploadsBase, panorama[dir]);
      await fs.remove(imagePath).catch(() => {});
      const thumbPath = imagePath.replace(/(\.[^.]+)$/, '_thumb$1');
      await fs.remove(thumbPath).catch(() => {});
    }

    // Удаляем запись из БД
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
/**
 * Загрузить видео для объекта
 * POST /api/properties/:id/videos
 */
async uploadVideos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Нет файлов для загрузки'
      });
      return;
    }

    // Проверяем существование объекта
    const property = await db.queryOne(
      'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      for (const file of files) {
        await fs.remove(file.path);
      }
      
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Получаем максимальный sort_order
    const maxOrder = await db.queryOne<any>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM property_videos WHERE property_id = ?',
      [id]
    );

    let currentOrder = (maxOrder?.max_order || -1) + 1;

    // Сохраняем информацию о видео в БД
    const videoIds: number[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const stats = await fs.stat(file.path);
      
      const uploadsIndex = file.path.indexOf('uploads');
      const dbPath = uploadsIndex !== -1 
        ? '/' + file.path.substring(uploadsIndex).replace(/\\/g, '/')
        : '/' + path.relative('/var/www/www-root/data/www/novaestate.company/backend', file.path).replace(/\\/g, '/');

      const result: any = await db.query(
        `INSERT INTO property_videos (property_id, video_url, file_size, mime_type, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [id, dbPath, stats.size, file.mimetype, currentOrder + i]
      );

      let insertId: number | undefined;
      if (Array.isArray(result)) {
        insertId = result[0]?.insertId;
      } else if (result?.insertId) {
        insertId = result.insertId;
      }

      if (insertId) {
        videoIds.push(insertId);
      }
    }

    logger.info(`Uploaded ${videoIds.length} videos for property ${id}`);

    res.status(201).json({
      success: true,
      message: `Загружено ${videoIds.length} видео`,
      data: { videoIds, count: videoIds.length }
    });

  } catch (error: any) {
    logger.error('Upload videos error:', error);
    
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      for (const file of files) {
        try {
          await fs.remove(file.path);
        } catch (e) {
          logger.error('Failed to remove file:', e);
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки видео'
    });
  }
}

/**
 * Удалить видео
 * DELETE /api/properties/:id/videos/:videoId
 */
async deleteVideo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id, videoId } = req.params;

    const video = await db.queryOne<any>(
      'SELECT video_url, thumbnail_url FROM property_videos WHERE id = ? AND property_id = ?',
      [videoId, id]
    );

    if (!video) {
      res.status(404).json({
        success: false,
        message: 'Видео не найдено'
      });
      return;
    }

    // Удаляем из БД
    await db.query('DELETE FROM property_videos WHERE id = ?', [videoId]);

    // Удаляем файлы
    const videoPath = path.join('/var/www/www-root/data/www/novaestate.company/backend', video.video_url);
    if (await fs.pathExists(videoPath)) {
      await fs.remove(videoPath);
    }

    if (video.thumbnail_url) {
      const thumbPath = path.join('/var/www/www-root/data/www/novaestate.company/backend', video.thumbnail_url);
      if (await fs.pathExists(thumbPath)) {
        await fs.remove(thumbPath);
      }
    }

    logger.info(`Video deleted: ${videoId} for property ${id}`);

    res.json({
      success: true,
      message: 'Видео удалено'
    });
  } catch (error) {
    logger.error('Delete video error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления видео'
    });
  }
}
/**
 * Обновить информацию о видео
 * PUT /api/properties/:id/videos/:videoId
 */
async updateVideo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id, videoId } = req.params;
    const { title, description, sort_order } = req.body;

    await db.query(
      `UPDATE property_videos 
       SET title = ?, description = ?, sort_order = ?
       WHERE id = ? AND property_id = ?`,
      [title || null, description || null, sort_order || 0, videoId, id]
    );

    res.json({
      success: true,
      message: 'Информация о видео обновлена'
    });
  } catch (error) {
    logger.error('Update video error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления видео'
    });
  }
}
  /**
 * Получить детальную информацию по ценам
 * GET /api/properties/:id/pricing-details
 */
  async getPricingDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
    
      // Базовые цены
      const property = await db.queryOne<any>(
        'SELECT sale_price, year_price, deal_type FROM properties WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
    
      if (!property) {
        res.status(404).json({
          success: false,
          message: 'Объект не найден'
        });
        return;
      }
    
      // Сезонные цены аренды
      const seasonalPricing = await db.query(
        `SELECT 
          season_type,
          start_date_recurring,
          end_date_recurring,
          price_per_night,
          source_price_per_night,
          minimum_nights
        FROM property_pricing 
        WHERE property_id = ? 
        ORDER BY start_date_recurring ASC`,
        [id]
      );
    
    res.json({
      success: true,
      data: {
        sale_price: property.sale_price,
        year_price: property.year_price,
        deal_type: property.deal_type,
        seasonal_pricing: seasonalPricing
      }
    });
    } catch (error) {
      logger.error('Get pricing details error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения цен'
      });
    }
  }
  
  /**
   * Получить календарь занятости
   * GET /api/properties/:id/calendar
   */
  async getCalendar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { start_date, end_date } = req.query;
    
      let query = `
        SELECT 
          id,
          property_id,
          blocked_date,
          reason,
          created_at
        FROM property_calendar 
        WHERE property_id = ?
      `;
    
      const params: any[] = [id];
    
      if (start_date) {
        query += ' AND blocked_date >= ?';
        params.push(start_date);
      }
    
      if (end_date) {
        query += ' AND blocked_date <= ?';
        params.push(end_date);
      }
    
      query += ' ORDER BY blocked_date ASC';
    
      const calendar = await db.query(query, params);
    
      // Получаем также бронирования
      const bookings = await db.query(
        `SELECT 
          id,
          guest_name,
          check_in_date,
          check_out_date,
          status,
          booking_source
        FROM property_bookings 
        WHERE property_id = ? 
        AND status != 'cancelled'
        ORDER BY check_in_date ASC`,
        [id]
      );
    
      res.json({
        success: true,
        data: {
          blocked_dates: calendar,
          bookings: bookings
        }
      });
    } catch (error) {
      logger.error('Get calendar error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения календаря'
      });
    }
  }
}

export default new PropertiesController();