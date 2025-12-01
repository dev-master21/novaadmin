// backend/src/controllers/properties.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import { imageProcessorService } from '../services/imageProcessor.service';
import fs from 'fs-extra';
import path from 'path';
import { getImageUrl } from '../utils/imageUrl';
import icsGeneratorService from '../services/icsGenerator.service';
import externalCalendarSyncService from '../services/externalCalendarSync.service';
import googleMapsService from '../services/googleMaps.service';
import aiDescriptionService from '../services/aiDescription.service';
import { NextFunction } from 'express';

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
      owner_name
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

    const properties = await db.query<any>(query, queryParams);

    // ✅ НОВОЕ: Проверяем права и фильтруем данные о владельце
    const canViewAllOwners = req.admin?.is_super_admin || 
                            (req.admin?.permissions && req.admin.permissions.includes('properties.update'));

    const propertiesWithUrls = properties.map((property: any) => {
      // Если нет прав на просмотр всех владельцев и пользователь не создатель - скрываем данные о владельце
      const shouldHideOwner = !canViewAllOwners && property.created_by !== req.admin?.id;
      
      return {
        ...property,
        cover_photo: getImageUrl(property.cover_photo, true),
        // Скрываем данные о владельце если нет прав
        owner_name: shouldHideOwner ? null : property.owner_name,
        owner_phone: shouldHideOwner ? null : property.owner_phone,
        owner_email: shouldHideOwner ? null : property.owner_email,
        owner_telegram: shouldHideOwner ? null : property.owner_telegram,
        owner_instagram: shouldHideOwner ? null : property.owner_instagram,
        owner_notes: shouldHideOwner ? null : property.owner_notes
      };
    });

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

    // Проверяем права на просмотр данных о владельце
    const canViewOwner = req.admin?.is_super_admin || 
                        (req.admin?.permissions && req.admin.permissions.includes('properties.update')) ||
                        property.created_by === req.admin?.id;

    if (!canViewOwner) {
      property.owner_name = null;
      property.owner_phone = null;
      property.owner_email = null;
      property.owner_telegram = null;
      property.owner_instagram = null;
      property.owner_notes = null;
    }

    // Загружаем переводы для всех языков
    const translationsResult = await db.query(
      'SELECT language_code, property_name, description FROM property_translations WHERE property_id = ?',
      [id]
    );

    const translationsMap: any = {};
    for (const t of translationsResult) {
      translationsMap[t.language_code] = {
        property_name: t.property_name,
        description: t.description
      };
    }

    const languages = ['ru', 'en', 'th', 'zh', 'he'];
    for (const lang of languages) {
      if (!translationsMap[lang]) {
        translationsMap[lang] = {
          property_name: '',
          description: ''
        };
      }
    }

    const translations = translationsMap;

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

    // ✅ ИЗМЕНЕНО: Загружаем сезонные цены с новыми полями
    const pricing = await db.query(
      `SELECT 
        id, season_type, start_date_recurring, end_date_recurring,
        price_per_night, source_price_per_night, minimum_nights, pricing_type,
        pricing_mode, commission_type, commission_value,
        source_price, margin_amount, margin_percentage
       FROM property_pricing 
       WHERE property_id = ? 
       ORDER BY start_date_recurring ASC`,
      [id]
    );

    // ✅ ИЗМЕНЕНО: Загружаем месячные цены с новыми полями
    const monthly_pricing = await db.query(
      `SELECT 
        id, month_number, price_per_month, minimum_days,
        pricing_mode, commission_type, commission_value,
        source_price, margin_amount, margin_percentage
       FROM property_pricing_monthly 
       WHERE property_id = ? 
       ORDER BY month_number ASC`,
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
      photo_url: getImageUrl(photo.photo_url, false),
      photo_url_thumb: getImageUrl(photo.photo_url, true)
    }));

    const vrPanoramasWithUrls = vrPanoramas.map((vr: any) => ({
      ...vr,
      panorama_url: getImageUrl(vr.panorama_url, false)
    }));

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
        monthly_pricing,
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
      latitude, longitude, property_number, property_name, complex_name,
      bedrooms, bathrooms, indoor_area, outdoor_area, plot_size,
      floors, floor, penthouse_floors, construction_year, construction_month,
      furniture_status, parking_spaces, pets_allowed, pets_custom,
      building_ownership, land_ownership, ownership_type,
      sale_price, year_price, minimum_nights, ics_calendar_url, status, video_url,
      
      // ✅ Старые поля комиссий (для обратной совместимости)
      sale_commission_type,
      sale_commission_value,
      rent_commission_type,
      rent_commission_value,
      
      // ✅ Sale Price - все новые поля
      sale_pricing_mode,
      sale_commission_type_new,
      sale_commission_value_new,
      sale_source_price,
      sale_margin_amount,
      sale_margin_percentage,
      
      // ✅ Year Price - все поля
      year_pricing_mode,
      year_commission_type,
      year_commission_value,
      year_source_price,
      year_margin_amount,
      year_margin_percentage,
      
      // Информация о владельце
      owner_name, owner_phone, owner_email, owner_telegram, owner_instagram, owner_notes,
      
      // Реновация
      renovation_type,
      renovation_date,
      
      // Включено в аренду, депозит, коммунальные
      rental_includes, deposit_type, deposit_amount, electricity_rate, water_rate,
      
      // Расстояние до пляжа
      distance_to_beach,
      
      // Переводы
      translations,
      
      // Features
      renovationDates,
      
      // Сезонные цены
      seasonalPricing,
      
      // Месячные цены
      monthlyPricing,
      
      // Данные от AI
      blockedDates,
      photosFromGoogleDrive
    } = req.body;

    // ✅ Функция для конвертации пустых строк в NULL
    const emptyToNull = (value: any) => {
      if (value === '' || value === undefined) return null;
      return value;
    };

    // ✅ Функция для валидации ENUM полей
    const validateEnum = (value: any, validValues: string[]) => {
      if (value === '' || value === undefined || value === null) return null;
      if (validValues.includes(value)) return value;
      return null;
    };

    // Автоматический расчет расстояния до пляжа
    let calculatedDistanceToBeach = distance_to_beach;

    if (latitude && longitude && !calculatedDistanceToBeach) {
      try {
        const beachDistance = await googleMapsService.calculateDistanceToNearestBeach({
          lat: parseFloat(latitude),
          lng: parseFloat(longitude)
        });
        
        calculatedDistanceToBeach = beachDistance.distance;
        logger.info(`Auto-calculated beach distance: ${calculatedDistanceToBeach}m to ${beachDistance.beachName}`);
      } catch (error) {
        logger.warn('Failed to auto-calculate beach distance:', error);
      }
    }

    // ✅ ИСПРАВЛЕНО: Добавлены ВСЕ поля включая старые комиссии
const propertyResult = await connection.query(
  `INSERT INTO properties (
    deal_type, property_type, region, address, google_maps_link,
    latitude, longitude, property_number, property_name, complex_name,
    bedrooms, bathrooms, indoor_area, outdoor_area, 
    distance_to_beach, plot_size,
    floors, floor, penthouse_floors, construction_year, construction_month,
    furniture_status, parking_spaces, pets_allowed, pets_custom,
    building_ownership, land_ownership, ownership_type,
    sale_price, sale_pricing_mode, sale_commission_type_new, sale_commission_value_new,
    sale_source_price, sale_margin_amount, sale_margin_percentage,
    minimum_nights, ics_calendar_url, video_url, status, created_by,
    owner_name, owner_phone, owner_email, owner_telegram, owner_instagram, owner_notes,
    year_price, year_pricing_mode, year_commission_type, year_commission_value,
    year_source_price, year_margin_amount, year_margin_percentage,
    sale_commission_type, sale_commission_value,
    rent_commission_type, rent_commission_value,
    renovation_type, renovation_date,
    rental_includes, deposit_type, deposit_amount, electricity_rate, water_rate
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    // 1-4: Обязательные поля
    deal_type,
    property_type,
    region,
    address,
    
    // 5-7: Google Maps
    emptyToNull(google_maps_link),
    emptyToNull(latitude),
    emptyToNull(longitude),
    
    // 8-10: Номер и названия
    property_number,
    property_name,
    emptyToNull(complex_name),
    
    // 11-14: Размеры помещений
    emptyToNull(bedrooms),
    emptyToNull(bathrooms),
    emptyToNull(indoor_area),
    emptyToNull(outdoor_area),
    
    // 15-16: Расстояние до пляжа и участок
    calculatedDistanceToBeach,
    emptyToNull(plot_size),
    
    // 17-22: Этажи и строительство
    emptyToNull(floors),
    emptyToNull(floor),
    emptyToNull(penthouse_floors),
    emptyToNull(construction_year),
    emptyToNull(construction_month),
    validateEnum(furniture_status, ['fullyFurnished', 'partiallyFurnished', 'unfurnished', 'builtIn', 'empty']),
    
    // 23-28: Парковка, животные, владение
    emptyToNull(parking_spaces),
    emptyToNull(pets_allowed),
    emptyToNull(pets_custom),
    emptyToNull(building_ownership),
    emptyToNull(land_ownership),
    emptyToNull(ownership_type),
    
    // 29-35: Sale Price с новыми полями
    emptyToNull(sale_price),
    validateEnum(sale_pricing_mode, ['net', 'gross']) || 'net',
    validateEnum(sale_commission_type_new, ['percentage', 'fixed']),
    emptyToNull(sale_commission_value_new),
    emptyToNull(sale_source_price),
    emptyToNull(sale_margin_amount),
    emptyToNull(sale_margin_percentage),
    
    // 36-39: Календарь и статус
    emptyToNull(minimum_nights),
    emptyToNull(ics_calendar_url),
    emptyToNull(video_url),
    status || 'draft',
    req.admin?.id,
    
    // 40-45: Информация о владельце
    emptyToNull(owner_name),
    emptyToNull(owner_phone),
    emptyToNull(owner_email),
    emptyToNull(owner_telegram),
    emptyToNull(owner_instagram),
    emptyToNull(owner_notes),
    
    // 46-52: Year Price с полями
    emptyToNull(year_price),
    validateEnum(year_pricing_mode, ['net', 'gross']) || 'net',
    validateEnum(year_commission_type, ['percentage', 'fixed']),
    emptyToNull(year_commission_value),
    emptyToNull(year_source_price),
    emptyToNull(year_margin_amount),
    emptyToNull(year_margin_percentage),
    
    // 53-56: Старые поля комиссий
    validateEnum(sale_commission_type, ['percentage', 'fixed']),
    emptyToNull(sale_commission_value),
    validateEnum(rent_commission_type, ['percentage', 'monthly_rent', 'fixed']),
    emptyToNull(rent_commission_value),
    
    // 57-58: Реновация
    validateEnum(renovation_type, ['full', 'partial']),
    emptyToNull(renovation_date),
    
    // 59-63: Аренда и депозит
    emptyToNull(rental_includes),
    validateEnum(deposit_type, ['one_month', 'two_months', 'custom']),
    emptyToNull(deposit_amount),
    emptyToNull(electricity_rate),
    emptyToNull(water_rate)
  ]
);

    const propertyId = (propertyResult as any)[0].insertId;
    logger.info(`Property created: ${propertyId} by user ${req.admin?.username}`);

    // Определяем массив языков
    const languages = ['ru', 'en', 'th', 'zh', 'he'];

    // Если указано property_name - добавляем его во все переводы
    if (property_name) {
      for (const lang of languages) {
        await connection.query(
          `INSERT INTO property_translations 
           (property_id, language_code, property_name, description, created_at, updated_at) 
           VALUES (?, ?, ?, '', NOW(), NOW())
           ON DUPLICATE KEY UPDATE 
           property_name = VALUES(property_name),
           updated_at = NOW()`,
          [propertyId, lang, property_name]
        );
      }
    }

    // Добавляем переводы (если они были переданы отдельно)
    if (translations && typeof translations === 'object') {
      for (const lang of languages) {
        if (translations[lang] && typeof translations[lang] === 'object') {
          const { property_name: translationName, description } = translations[lang];
        
          if (description || translationName) {
            await connection.query(
              `INSERT INTO property_translations 
               (property_id, language_code, property_name, description, created_at, updated_at) 
               VALUES (?, ?, ?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE 
               property_name = VALUES(property_name),
               description = VALUES(description),
               updated_at = NOW()`,
              [propertyId, lang, translationName || property_name || '', description || '']
            );
          }
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
          `INSERT INTO property_pricing (
            property_id, season_type, start_date_recurring, end_date_recurring, 
            price_per_night, source_price_per_night, minimum_nights, pricing_type,
            pricing_mode, commission_type, commission_value, 
            source_price, margin_amount, margin_percentage
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            propertyId,
            price.season_type || null,
            price.start_date_recurring,
            price.end_date_recurring,
            price.price_per_night,
            price.source_price_per_night || null,
            price.minimum_nights || null,
            price.pricing_type || 'per_night',
            price.pricing_mode || 'net',
            price.commission_type || null,
            price.commission_value || null,
            price.source_price || null,
            price.margin_amount || null,
            price.margin_percentage || null
          ]
        );
      }
    }

    // Добавляем месячные цены
    if (monthlyPricing && Array.isArray(monthlyPricing) && monthlyPricing.length > 0) {
      for (const price of monthlyPricing) {
        await connection.query(
          `INSERT INTO property_pricing_monthly 
           (property_id, month_number, price_per_month, minimum_days,
            pricing_mode, commission_type, commission_value,
            source_price, margin_amount, margin_percentage)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            propertyId,
            price.month_number,
            price.price_per_month,
            price.minimum_days || null,
            price.pricing_mode || 'net',
            price.commission_type || null,
            price.commission_value || null,
            price.source_price || null,
            price.margin_amount || null,
            price.margin_percentage || null
          ]
        );
      }
      logger.info(`Saved ${monthlyPricing.length} monthly pricing entries`);
    }

    // Сохраняем заблокированные даты от AI
    if (blockedDates && Array.isArray(blockedDates) && blockedDates.length > 0) {
      for (const blocked of blockedDates) {
        await connection.query(
          `INSERT INTO property_calendar 
           (property_id, blocked_date, reason)
           VALUES (?, ?, ?)`,
          [
            propertyId,
            blocked.blocked_date,
            blocked.reason || 'Unknown'
          ]
        );
      }
      logger.info(`Saved ${blockedDates.length} blocked dates from AI`);
      logger.info(`ICS file will be generated automatically by cron job for property ${propertyId}`);
    }

    // Загружаем фотографии из Google Drive
    if (photosFromGoogleDrive) {
      logger.info(`Starting Google Drive download: ${photosFromGoogleDrive}`);
      
      try {
        const downloadedPhotos = await this.downloadPhotosFromGoogleDrive(photosFromGoogleDrive);
        
        logger.info(`Successfully downloaded ${downloadedPhotos.length} photos from Google Drive`);
        
        if (downloadedPhotos.length > 0) {
          const uploadsPath = '/var/www/www-root/data/www/novaestate.company/backend/uploads';
          const propertyPhotosPath = path.join(uploadsPath, 'properties', 'photos', String(propertyId));
          await fs.ensureDir(propertyPhotosPath);
        
          let sortOrder = 0;
          for (const photoData of downloadedPhotos) {
            if (photoData.path && await fs.pathExists(photoData.path)) {
              try {
                const fileName = `photo_${Date.now()}_${sortOrder}.jpg`;
                const finalPath = path.join(propertyPhotosPath, fileName);
                
                await fs.copy(photoData.path, finalPath);
                await fs.remove(photoData.path).catch(() => {});
              
                const relativePath = `/uploads/properties/photos/${propertyId}/${fileName}`;
              
                await connection.query(
                  `INSERT INTO property_photos (
                    property_id, photo_url, category, sort_order, is_primary
                  ) VALUES (?, ?, ?, ?, ?)`,
                  [
                    propertyId,
                    relativePath,
                    photoData.category,
                    sortOrder,
                    sortOrder === 0 ? 1 : 0
                  ]
                );
              
                logger.info(`Added photo ${sortOrder + 1}/${downloadedPhotos.length} for property ${propertyId}`);
                sortOrder++;
              } catch (photoSaveError) {
                logger.error(`Failed to save photo ${sortOrder}:`, photoSaveError);
              }
            }
          }
        
          logger.info(`✅ Successfully added ${sortOrder} photos from Google Drive for property ${propertyId}`);
        }
      } catch (photoError: any) {
        logger.error('❌ Failed to download photos from Google Drive:', photoError);
      }
    }

    await db.commit(connection);

    res.status(201).json({
      success: true,
      message: 'Объект успешно создан',
      data: { 
        propertyId,
        distance_to_beach: calculatedDistanceToBeach
      }
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
 * ✅ ИСПРАВЛЕНО: Обновить объект недвижимости
 * PUT /api/properties/:id
 */
async update(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();
  
  try {
    const { id } = req.params;

    // ✅ Сначала получаем текущие данные объекта
    const existingPropertyResult: any = await connection.query(
      'SELECT * FROM properties WHERE id = ? AND deleted_at IS NULL',
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

    // ✅ НОВОЕ: Функция для конвертации пустых строк в NULL
    const emptyToNull = (value: any) => {
      if (value === '' || value === undefined) return null;
      return value;
    };

    // ✅ НОВОЕ: Функция для валидации ENUM полей
    const validateEnum = (value: any, validValues: string[]) => {
      if (value === '' || value === undefined || value === null) return null;
      if (validValues.includes(value)) return value;
      return null;
    };

    // ✅ НОВОЕ: Берем значения из req.body, если они есть, иначе - из existingProperty
    const updateData = {
      deal_type: req.body.deal_type !== undefined ? req.body.deal_type : existingProperty.deal_type,
      property_type: req.body.property_type !== undefined ? req.body.property_type : existingProperty.property_type,
      region: req.body.region !== undefined ? req.body.region : existingProperty.region,
      address: req.body.address !== undefined ? req.body.address : existingProperty.address,
      google_maps_link: req.body.google_maps_link !== undefined ? emptyToNull(req.body.google_maps_link) : existingProperty.google_maps_link,
      
      latitude: req.body.latitude !== undefined ? emptyToNull(req.body.latitude) : existingProperty.latitude,
      longitude: req.body.longitude !== undefined ? emptyToNull(req.body.longitude) : existingProperty.longitude,
      property_number: req.body.property_number !== undefined ? req.body.property_number : existingProperty.property_number,
      property_name: req.body.property_name !== undefined ? emptyToNull(req.body.property_name) : existingProperty.property_name,
      complex_name: req.body.complex_name !== undefined ? emptyToNull(req.body.complex_name) : existingProperty.complex_name,
      
      bedrooms: req.body.bedrooms !== undefined ? emptyToNull(req.body.bedrooms) : existingProperty.bedrooms,
      bathrooms: req.body.bathrooms !== undefined ? emptyToNull(req.body.bathrooms) : existingProperty.bathrooms,
      indoor_area: req.body.indoor_area !== undefined ? emptyToNull(req.body.indoor_area) : existingProperty.indoor_area,
      outdoor_area: req.body.outdoor_area !== undefined ? emptyToNull(req.body.outdoor_area) : existingProperty.outdoor_area,
      plot_size: req.body.plot_size !== undefined ? emptyToNull(req.body.plot_size) : existingProperty.plot_size,
      
      floors: req.body.floors !== undefined ? emptyToNull(req.body.floors) : existingProperty.floors,
      floor: req.body.floor !== undefined ? emptyToNull(req.body.floor) : existingProperty.floor,
      penthouse_floors: req.body.penthouse_floors !== undefined ? emptyToNull(req.body.penthouse_floors) : existingProperty.penthouse_floors,
      construction_year: req.body.construction_year !== undefined ? emptyToNull(req.body.construction_year) : existingProperty.construction_year,
      construction_month: req.body.construction_month !== undefined ? emptyToNull(req.body.construction_month) : existingProperty.construction_month,
      
      furniture_status: req.body.furniture_status !== undefined 
        ? validateEnum(req.body.furniture_status, ['fullyFurnished', 'partiallyFurnished', 'unfurnished', 'builtIn', 'empty'])
        : existingProperty.furniture_status,
      
      parking_spaces: req.body.parking_spaces !== undefined ? emptyToNull(req.body.parking_spaces) : existingProperty.parking_spaces,
      pets_allowed: req.body.pets_allowed !== undefined ? emptyToNull(req.body.pets_allowed) : existingProperty.pets_allowed,
      pets_custom: req.body.pets_custom !== undefined ? emptyToNull(req.body.pets_custom) : existingProperty.pets_custom,
      
      building_ownership: req.body.building_ownership !== undefined ? emptyToNull(req.body.building_ownership) : existingProperty.building_ownership,
      land_ownership: req.body.land_ownership !== undefined ? emptyToNull(req.body.land_ownership) : existingProperty.land_ownership,
      ownership_type: req.body.ownership_type !== undefined ? emptyToNull(req.body.ownership_type) : existingProperty.ownership_type,
      
      sale_price: req.body.sale_price !== undefined ? emptyToNull(req.body.sale_price) : existingProperty.sale_price,
      year_price: req.body.year_price !== undefined ? emptyToNull(req.body.year_price) : existingProperty.year_price,
      minimum_nights: req.body.minimum_nights !== undefined ? emptyToNull(req.body.minimum_nights) : existingProperty.minimum_nights,
      ics_calendar_url: req.body.ics_calendar_url !== undefined ? emptyToNull(req.body.ics_calendar_url) : existingProperty.ics_calendar_url,
      video_url: req.body.video_url !== undefined ? emptyToNull(req.body.video_url) : existingProperty.video_url,
      status: req.body.status !== undefined ? req.body.status : existingProperty.status,
      
      owner_name: req.body.owner_name !== undefined ? emptyToNull(req.body.owner_name) : existingProperty.owner_name,
      owner_phone: req.body.owner_phone !== undefined ? emptyToNull(req.body.owner_phone) : existingProperty.owner_phone,
      owner_email: req.body.owner_email !== undefined ? emptyToNull(req.body.owner_email) : existingProperty.owner_email,
      owner_telegram: req.body.owner_telegram !== undefined ? emptyToNull(req.body.owner_telegram) : existingProperty.owner_telegram,
      owner_instagram: req.body.owner_instagram !== undefined ? emptyToNull(req.body.owner_instagram) : existingProperty.owner_instagram,
      owner_notes: req.body.owner_notes !== undefined ? emptyToNull(req.body.owner_notes) : existingProperty.owner_notes,
      
      // ✅ ИСПРАВЛЕНО: Старые поля комиссий (для обратной совместимости)
      sale_commission_type: req.body.sale_commission_type !== undefined 
        ? validateEnum(req.body.sale_commission_type, ['percentage', 'fixed'])
        : existingProperty.sale_commission_type,
      sale_commission_value: req.body.sale_commission_value !== undefined ? emptyToNull(req.body.sale_commission_value) : existingProperty.sale_commission_value,
      
      rent_commission_type: req.body.rent_commission_type !== undefined 
        ? validateEnum(req.body.rent_commission_type, ['percentage', 'monthly_rent', 'fixed'])
        : existingProperty.rent_commission_type,
      rent_commission_value: req.body.rent_commission_value !== undefined ? emptyToNull(req.body.rent_commission_value) : existingProperty.rent_commission_value,
      
      // ✅ НОВОЕ: Поля для годовой цены
      year_pricing_mode: req.body.year_pricing_mode !== undefined 
        ? validateEnum(req.body.year_pricing_mode, ['net', 'gross'])
        : existingProperty.year_pricing_mode,
      year_commission_type: req.body.year_commission_type !== undefined 
        ? validateEnum(req.body.year_commission_type, ['percentage', 'fixed'])
        : existingProperty.year_commission_type,
      year_commission_value: req.body.year_commission_value !== undefined ? emptyToNull(req.body.year_commission_value) : existingProperty.year_commission_value,
      year_source_price: req.body.year_source_price !== undefined ? emptyToNull(req.body.year_source_price) : existingProperty.year_source_price,
      year_margin_amount: req.body.year_margin_amount !== undefined ? emptyToNull(req.body.year_margin_amount) : existingProperty.year_margin_amount,
      year_margin_percentage: req.body.year_margin_percentage !== undefined ? emptyToNull(req.body.year_margin_percentage) : existingProperty.year_margin_percentage,
      
      // ✅ НОВОЕ: Поля для цены продажи
      sale_pricing_mode: req.body.sale_pricing_mode !== undefined 
        ? validateEnum(req.body.sale_pricing_mode, ['net', 'gross'])
        : existingProperty.sale_pricing_mode,
      sale_commission_type_new: req.body.sale_commission_type_new !== undefined 
        ? validateEnum(req.body.sale_commission_type_new, ['percentage', 'fixed'])
        : existingProperty.sale_commission_type_new,
      sale_commission_value_new: req.body.sale_commission_value_new !== undefined ? emptyToNull(req.body.sale_commission_value_new) : existingProperty.sale_commission_value_new,
      sale_source_price: req.body.sale_source_price !== undefined ? emptyToNull(req.body.sale_source_price) : existingProperty.sale_source_price,
      sale_margin_amount: req.body.sale_margin_amount !== undefined ? emptyToNull(req.body.sale_margin_amount) : existingProperty.sale_margin_amount,
      sale_margin_percentage: req.body.sale_margin_percentage !== undefined ? emptyToNull(req.body.sale_margin_percentage) : existingProperty.sale_margin_percentage,
      
      renovation_type: req.body.renovation_type !== undefined 
        ? validateEnum(req.body.renovation_type, ['full', 'partial'])
        : existingProperty.renovation_type,
      renovation_date: req.body.renovation_date !== undefined ? emptyToNull(req.body.renovation_date) : existingProperty.renovation_date,
      
      rental_includes: req.body.rental_includes !== undefined ? emptyToNull(req.body.rental_includes) : existingProperty.rental_includes,
      
      deposit_type: req.body.deposit_type !== undefined 
        ? validateEnum(req.body.deposit_type, ['one_month', 'two_months', 'custom'])
        : existingProperty.deposit_type,
      deposit_amount: req.body.deposit_amount !== undefined ? emptyToNull(req.body.deposit_amount) : existingProperty.deposit_amount,
      electricity_rate: req.body.electricity_rate !== undefined ? emptyToNull(req.body.electricity_rate) : existingProperty.electricity_rate,
      water_rate: req.body.water_rate !== undefined ? emptyToNull(req.body.water_rate) : existingProperty.water_rate,
      
      distance_to_beach: req.body.distance_to_beach !== undefined ? emptyToNull(req.body.distance_to_beach) : existingProperty.distance_to_beach
    };

    // ✅ Автоматический пересчет расстояния до пляжа если координаты изменились
    if (updateData.latitude && updateData.longitude) {
      const coordsChanged = 
        parseFloat(existingProperty.latitude || '0') !== parseFloat(updateData.latitude) || 
        parseFloat(existingProperty.longitude || '0') !== parseFloat(updateData.longitude);

      if (coordsChanged || !existingProperty.distance_to_beach) {
        try {
          const beachDistance = await googleMapsService.calculateDistanceToNearestBeach({
            lat: parseFloat(updateData.latitude),
            lng: parseFloat(updateData.longitude)
          });
          
          updateData.distance_to_beach = beachDistance.distance;
          logger.info(`Auto-recalculated beach distance: ${beachDistance.distance}m to ${beachDistance.beachName}`);
        } catch (error) {
          logger.warn('Failed to auto-calculate beach distance:', error);
        }
      }
    }

    // ✅ Обновляем основную информацию
    await connection.query(
      `UPDATE properties SET
        deal_type = ?, property_type = ?, region = ?, address = ?, google_maps_link = ?,
        latitude = ?, longitude = ?, property_number = ?, property_name = ?, complex_name = ?,
        bedrooms = ?, bathrooms = ?, indoor_area = ?, outdoor_area = ?, plot_size = ?,
        floors = ?, floor = ?, penthouse_floors = ?, construction_year = ?, construction_month = ?,
        furniture_status = ?, parking_spaces = ?, pets_allowed = ?, pets_custom = ?,
        building_ownership = ?, land_ownership = ?, ownership_type = ?,
        sale_price = ?, year_price = ?, minimum_nights = ?, ics_calendar_url = ?, video_url = ?, status = ?,
        owner_name = ?, owner_phone = ?, owner_email = ?, owner_telegram = ?, owner_instagram = ?, owner_notes = ?,
        sale_commission_type = ?, sale_commission_value = ?,
        rent_commission_type = ?, rent_commission_value = ?,
        year_pricing_mode = ?, year_commission_type = ?, year_commission_value = ?,
        year_source_price = ?, year_margin_amount = ?, year_margin_percentage = ?,
        sale_pricing_mode = ?, sale_commission_type_new = ?, sale_commission_value_new = ?,
        sale_source_price = ?, sale_margin_amount = ?, sale_margin_percentage = ?,
        renovation_type = ?, renovation_date = ?,
        rental_includes = ?, deposit_type = ?, deposit_amount = ?, electricity_rate = ?, water_rate = ?,
        distance_to_beach = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        updateData.deal_type,
        updateData.property_type,
        updateData.region,
        updateData.address,
        updateData.google_maps_link,
        updateData.latitude,
        updateData.longitude,
        updateData.property_number,
        updateData.property_name,
        updateData.complex_name,
        updateData.bedrooms,
        updateData.bathrooms,
        updateData.indoor_area,
        updateData.outdoor_area,
        updateData.plot_size,
        updateData.floors,
        updateData.floor,
        updateData.penthouse_floors,
        updateData.construction_year,
        updateData.construction_month,
        updateData.furniture_status,
        updateData.parking_spaces,
        updateData.pets_allowed,
        updateData.pets_custom,
        updateData.building_ownership,
        updateData.land_ownership,
        updateData.ownership_type,
        updateData.sale_price,
        updateData.year_price,
        updateData.minimum_nights,
        updateData.ics_calendar_url,
        updateData.video_url,
        updateData.status,
        updateData.owner_name,
        updateData.owner_phone,
        updateData.owner_email,
        updateData.owner_telegram,
        updateData.owner_instagram,
        updateData.owner_notes,
        updateData.sale_commission_type,
        updateData.sale_commission_value,
        updateData.rent_commission_type,
        updateData.rent_commission_value,
        // ✅ НОВОЕ: Годовая цена
        updateData.year_pricing_mode,
        updateData.year_commission_type,
        updateData.year_commission_value,
        updateData.year_source_price,
        updateData.year_margin_amount,
        updateData.year_margin_percentage,
        // ✅ НОВОЕ: Цена продажи
        updateData.sale_pricing_mode,
        updateData.sale_commission_type_new,
        updateData.sale_commission_value_new,
        updateData.sale_source_price,
        updateData.sale_margin_amount,
        updateData.sale_margin_percentage,
        updateData.renovation_type,
        updateData.renovation_date,
        updateData.rental_includes,
        updateData.deposit_type,
        updateData.deposit_amount,
        updateData.electricity_rate,
        updateData.water_rate,
        updateData.distance_to_beach,
        id
      ]
    );
    
    // ✅ Обновляем переводы только если они переданы
    if (req.body.translations !== undefined || req.body.property_name !== undefined) {
      const languages = ['ru', 'en', 'th', 'zh', 'he'];
      const translations = req.body.translations || {};
      const property_name = req.body.property_name;

      for (const lang of languages) {
        const translationData = translations[lang];
        const description = translationData?.description || '';
        const nameToUse = property_name || translationData?.property_name || '';
        
        if (description || nameToUse) {
          await connection.query(
            `INSERT INTO property_translations 
             (property_id, language_code, property_name, description, created_at, updated_at) 
             VALUES (?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE 
             property_name = VALUES(property_name),
             description = VALUES(description),
             updated_at = NOW()`,
            [id, lang, nameToUse, description]
          );
        }
      }
    }

    // ✅ Обновляем features только если они переданы
    const featureTypes: { [key: string]: string } = {
      propertyFeatures: 'property',
      outdoorFeatures: 'outdoor',
      rentalFeatures: 'rental',
      locationFeatures: 'location',
      views: 'view'
    };

    const hasAnyFeatures = Object.keys(featureTypes).some(key => req.body[key] !== undefined);
    
    if (hasAnyFeatures) {
      await connection.query('DELETE FROM property_features WHERE property_id = ?', [id]);

      for (const [key, type] of Object.entries(featureTypes)) {
        const featuresArray = req.body[key];
        if (featuresArray && Array.isArray(featuresArray) && featuresArray.length > 0) {
          for (const feature of featuresArray) {
            const renovationDate = req.body.renovationDates?.[feature] || null;
            await connection.query(
              `INSERT INTO property_features (property_id, feature_type, feature_value, renovation_date)
               VALUES (?, ?, ?, ?)`,
              [id, type, feature, renovationDate]
            );
          }
        }
      }
    }

    // ✅ Обновляем сезонные цены только если они переданы
    if (req.body.seasonalPricing !== undefined) {
      await connection.query('DELETE FROM property_pricing WHERE property_id = ?', [id]);

      if (Array.isArray(req.body.seasonalPricing) && req.body.seasonalPricing.length > 0) {
        for (const price of req.body.seasonalPricing) {
          await connection.query(
            `INSERT INTO property_pricing (
              property_id, season_type, start_date_recurring, end_date_recurring, 
              price_per_night, source_price_per_night, minimum_nights, pricing_type,
              pricing_mode, commission_type, commission_value,
              source_price, margin_amount, margin_percentage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              price.season_type || 'custom',
              price.start_date_recurring,
              price.end_date_recurring,
              price.price_per_night,
              price.source_price_per_night || null,
              price.minimum_nights || null,
              price.pricing_type || 'per_night',
              price.pricing_mode || 'net',
              emptyToNull(price.commission_type),
              emptyToNull(price.commission_value),
              emptyToNull(price.source_price),
              emptyToNull(price.margin_amount),
              emptyToNull(price.margin_percentage)
            ]
          );
        }
      }
    }

    // ✅ Обновляем месячные цены только если они переданы
    if (req.body.monthlyPricing !== undefined) {
      await connection.query('DELETE FROM property_pricing_monthly WHERE property_id = ?', [id]);

      if (Array.isArray(req.body.monthlyPricing) && req.body.monthlyPricing.length > 0) {
        for (const price of req.body.monthlyPricing) {
          // Пропускаем месяцы с null ценой
          if (price.price_per_month === null || price.price_per_month === undefined || price.price_per_month === '') {
            continue;
          }

          await connection.query(
            `INSERT INTO property_pricing_monthly 
             (property_id, month_number, price_per_month, minimum_days,
              pricing_mode, commission_type, commission_value,
              source_price, margin_amount, margin_percentage)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              price.month_number,
              price.price_per_month,
              emptyToNull(price.minimum_days),
              price.pricing_mode || 'net',
              emptyToNull(price.commission_type),
              emptyToNull(price.commission_value),
              emptyToNull(price.source_price),
              emptyToNull(price.margin_amount),
              emptyToNull(price.margin_percentage)
            ]
          );
        }
      }
    }

    await connection.commit();
    logger.info(`Property updated: ${id} by user ${req.admin?.username}`);

    res.json({
      success: true,
      message: 'Объект успешно обновлен',
      data: {
        distance_to_beach: updateData.distance_to_beach
      }
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
 * Добавить период занятости
 * POST /api/properties/:id/calendar/block
 */
async addBlockedPeriod(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();
  
  try {
    const { id } = req.params;
    const { start_date, end_date, reason } = req.body;

    const propertyResult: any = await connection.query(
      'SELECT id, property_number FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    const properties = Array.isArray(propertyResult[0]) 
      ? propertyResult[0] 
      : propertyResult;

    const property = properties[0];

    if (!property) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    const startDate = new Date(start_date + 'T00:00:00Z');
    const endDate = new Date(end_date + 'T00:00:00Z');
    const dates: string[] = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getUTCFullYear();
      const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getUTCDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    if (dates.length === 0) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'Некорректный период дат'
      });
      return;
    }

    // УБРАЛИ ПРОВЕРКУ КОНФЛИКТОВ - теперь просто добавляем или обновляем

    // Определяем первую и последнюю даты для пометки check-in/check-out
    const isCheckIn = (dateStr: string) => dateStr === dates[0];
    const isCheckOut = (dateStr: string) => dateStr === dates[dates.length - 1];

    for (const date of dates) {
      // Используем INSERT ... ON DUPLICATE KEY UPDATE для автоматической перезаписи
      await connection.query(
        `INSERT INTO property_calendar 
         (property_id, blocked_date, reason, source_calendar_id, is_check_in, is_check_out)
         VALUES (?, ?, ?, NULL, ?, ?)
         ON DUPLICATE KEY UPDATE
           reason = VALUES(reason),
           source_calendar_id = NULL,
           is_check_in = VALUES(is_check_in),
           is_check_out = VALUES(is_check_out)`,
        [id, date, reason || null, isCheckIn(date) ? 1 : 0, isCheckOut(date) ? 1 : 0]
      );
    }

    // Получаем ВСЕ заблокированные даты
    const allBlockedDatesResult: any = await connection.query(
      'SELECT blocked_date, reason FROM property_calendar WHERE property_id = ? ORDER BY blocked_date',
      [id]
    );

    const allBlockedDates = Array.isArray(allBlockedDatesResult[0]) 
      ? allBlockedDatesResult[0] 
      : [];

    const icsData = await icsGeneratorService.generateICSFile(
      property.id,
      property.property_number,
      allBlockedDates
    );

    await connection.query(
      `INSERT INTO property_ics (property_id, ics_url, ics_filename, ics_file_path, total_blocked_days)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         ics_url = VALUES(ics_url),
         ics_filename = VALUES(ics_filename),
         ics_file_path = VALUES(ics_file_path),
         total_blocked_days = VALUES(total_blocked_days),
         updated_at = NOW()`,
      [id, icsData.url, icsData.filename, icsData.filepath, allBlockedDates.length]
    );

    await connection.commit();

    logger.info(`Blocked period added for property ${id}: ${start_date} to ${end_date}`);

    res.json({
      success: true,
      message: `Заблокировано ${dates.length} дней`,
      data: {
        blocked_dates: dates,
        ics_url: icsData.url
      }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Add blocked period error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка добавления периода занятости'
    });
  }
}

/**
 * Удалить заблокированные даты
 * DELETE /api/properties/:id/calendar/block
 */
async removeBlockedDates(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();
  
  try {
    const { id } = req.params;
    const { dates } = req.body; // Массив дат для удаления

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'Необходимо указать даты для удаления'
      });
      return;
    }

    // Проверяем существование объекта
    const propertyResult: any = await connection.query(
      'SELECT id, property_number FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    const property = Array.isArray(propertyResult[0]) 
      ? propertyResult[0][0] 
      : propertyResult[0];

    if (!property) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Удаляем указанные даты
    await connection.query(
      `DELETE FROM property_calendar 
       WHERE property_id = ? AND blocked_date IN (${dates.map(() => '?').join(',')})`,
      [id, ...dates]
    );

    // Получаем оставшиеся заблокированные даты
    const remainingDates = await connection.query<any>(
      'SELECT blocked_date, reason FROM property_calendar WHERE property_id = ? ORDER BY blocked_date',
      [id]
    );

    const remainingDatesArray = Array.isArray(remainingDates[0]) 
      ? remainingDates[0] 
      : remainingDates;

    // Обновляем .ics файл
    if (remainingDatesArray.length > 0) {
      const icsData = await icsGeneratorService.generateICSFile(
        property.id,
        property.property_number,
        remainingDatesArray
      );

      await connection.query(
        `UPDATE property_ics 
         SET ics_url = ?, ics_filename = ?, ics_file_path = ?, 
             total_blocked_days = ?, updated_at = NOW()
         WHERE property_id = ?`,
        [icsData.url, icsData.filename, icsData.filepath, remainingDatesArray.length, id]
      );
    } else {
      // Если дат не осталось, удаляем .ics файл
      const icsInfoResult: any = await connection.query(
        'SELECT ics_file_path FROM property_ics WHERE property_id = ?',
        [id]
      );

      const icsInfo = Array.isArray(icsInfoResult[0]) 
        ? icsInfoResult[0][0] 
        : icsInfoResult[0];

      if (icsInfo) {
        await icsGeneratorService.deleteICSFile(icsInfo.ics_file_path);
        await connection.query('DELETE FROM property_ics WHERE property_id = ?', [id]);
      }
    }

    await connection.commit();

    logger.info(`Removed ${dates.length} blocked dates for property ${id}`);

    res.json({
      success: true,
      message: `Удалено ${dates.length} заблокированных дат`
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Remove blocked dates error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления заблокированных дат'
    });
  }
}

/**
 * Получить информацию о .ics файле
 * GET /api/properties/:id/ics
 */
async getICSInfo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const icsInfo = await db.queryOne<any>(
      'SELECT * FROM property_ics WHERE property_id = ?',
      [id]
    );

    if (!icsInfo) {
      res.json({
        success: true,
        data: null
      });
      return;
    }

    res.json({
      success: true,
      data: icsInfo
    });
  } catch (error) {
    logger.error('Get ICS info error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения информации о .ics файле'
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

    const property = await db.queryOne<any>(
      `SELECT sale_price, year_price, deal_type 
       FROM properties 
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // ✅ ИЗМЕНЕНО: Сезонные цены с новыми полями
    const seasonalPricing = await db.query(
      `SELECT 
        id,
        season_type,
        start_date_recurring,
        end_date_recurring,
        price_per_night,
        source_price_per_night,
        minimum_nights,
        pricing_type,
        pricing_mode,
        commission_type,
        commission_value,
        source_price,
        margin_amount,
        margin_percentage
      FROM property_pricing 
      WHERE property_id = ? 
      ORDER BY start_date_recurring ASC`,
      [id]
    );

    // ✅ ИЗМЕНЕНО: Месячные цены с новыми полями
    const monthlyPricing = await db.query(
      `SELECT 
        id,
        month_number,
        price_per_month,
        minimum_days,
        pricing_mode,
        commission_type,
        commission_value,
        source_price,
        margin_amount,
        margin_percentage
      FROM property_pricing_monthly 
      WHERE property_id = ? 
      ORDER BY month_number ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        sale_price: property.sale_price,
        year_price: property.year_price,
        deal_type: property.deal_type,
        seasonal_pricing: seasonalPricing,
        monthly_pricing: monthlyPricing
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
  

async updateMonthlyPricing(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();
  
  try {
    const { id } = req.params;
    const { monthlyPricing } = req.body;

    // Проверяем существование объекта
    const property = await db.queryOne(
      'SELECT id FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // ✅ ИЗМЕНЕНО: Удаляем все старые месячные цены
    await connection.query(
      'DELETE FROM property_pricing_monthly WHERE property_id = ?',
      [id]
    );

    // ✅ ИЗМЕНЕНО: Добавляем только те месяцы, у которых price_per_month не null
    if (Array.isArray(monthlyPricing) && monthlyPricing.length > 0) {
      for (const price of monthlyPricing) {
        // ✅ Пропускаем месяцы с null/undefined ценой (они будут удалены)
        if (price.price_per_month === null || 
            price.price_per_month === undefined || 
            price.price_per_month === '') {
          logger.info(`Skipping month ${price.month_number} - price is null (will be deleted)`);
          continue;
        }

        await connection.query(
          `INSERT INTO property_pricing_monthly 
           (property_id, month_number, price_per_month, minimum_days,
            pricing_mode, commission_type, commission_value,
            source_price, margin_amount, margin_percentage)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            price.month_number,
            price.price_per_month,
            price.minimum_days || null,
            price.pricing_mode || 'net',
            price.commission_type || null,
            price.commission_value || null,
            price.source_price || null,
            price.margin_amount || null,
            price.margin_percentage || null
          ]
        );
      }
    }

    await connection.commit();

    logger.info(`Monthly pricing updated for property ${id} by user ${req.admin?.username}`);

    res.json({
      success: true,
      message: 'Месячные цены успешно обновлены'
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Update monthly pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления месячных цен'
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
        DATE_FORMAT(blocked_date, '%Y-%m-%d') as blocked_date,
        reason,
        is_check_in,
        is_check_out,
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
        DATE_FORMAT(check_in_date, '%Y-%m-%d') as check_in_date,
        DATE_FORMAT(check_out_date, '%Y-%m-%d') as check_out_date,
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

/**
 * Получить список внешних календарей
 * GET /api/properties/:id/external-calendars
 */
async getExternalCalendars(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const calendars = await db.query(
      `SELECT id, property_id, calendar_name, ics_url, is_enabled, 
              last_sync_at, sync_error, total_events, created_at, updated_at
       FROM property_external_calendars
       WHERE property_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: calendars
    });
  } catch (error) {
    logger.error('Get external calendars error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения списка календарей'
    });
  }
}

/**
 * Добавить внешний календарь
 * POST /api/properties/:id/external-calendars
 */
async addExternalCalendar(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { calendar_name, ics_url } = req.body;

    if (!calendar_name || !ics_url) {
      res.status(400).json({
        success: false,
        message: 'Необходимо указать название и URL календаря'
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

    // Валидируем .ics URL
    const validation = await externalCalendarSyncService.validateIcsUrl(ics_url);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: validation.error || 'Невалидный .ics файл'
      });
      return;
    }

    // Добавляем календарь
    const result: any = await db.query(
      `INSERT INTO property_external_calendars (property_id, calendar_name, ics_url)
       VALUES (?, ?, ?)`,
      [id, calendar_name, ics_url]
    );

    const calendarId = Array.isArray(result) ? result[0]?.insertId : result?.insertId;

    logger.info(`External calendar added: ${calendarId} for property ${id}`);

    res.status(201).json({
      success: true,
      message: 'Календарь успешно добавлен',
      data: {
        calendar_id: calendarId,
        events_count: validation.eventsCount
      }
    });
  } catch (error) {
    logger.error('Add external calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка добавления календаря'
    });
  }
}

/**
 * Удалить внешний календарь
 * DELETE /api/properties/:id/external-calendars/:calendarId
 */
async removeExternalCalendar(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const { id, calendarId } = req.params;
    const { remove_dates } = req.body;

    const calendarResult: any = await connection.query(
      'SELECT id, property_id FROM property_external_calendars WHERE id = ? AND property_id = ?',
      [calendarId, id]
    );

    const calendars = Array.isArray(calendarResult[0]) ? calendarResult[0] : calendarResult;
    const calendar = calendars[0];

    if (!calendar) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Календарь не найден'
      });
      return;
    }

    // Если нужно удалить даты
    if (remove_dates === true || remove_dates === 'true') {
      await connection.query(
        'DELETE FROM property_calendar WHERE property_id = ? AND source_calendar_id = ?',
        [id, calendarId]
      );

      logger.info(`Deleted dates from calendar ${calendarId} for property ${id}`);
    }

    // Удаляем календарь
    await connection.query(
      'DELETE FROM property_external_calendars WHERE id = ?',
      [calendarId]
    );

    // Регенерируем .ics файл
    const propertyResult: any = await connection.query(
      'SELECT property_number FROM properties WHERE id = ?',
      [id]
    );

    const properties = Array.isArray(propertyResult[0])
      ? propertyResult[0]
      : propertyResult;

    const property = properties[0];

    if (property) {
      const allBlockedDatesResult: any = await connection.query(
        'SELECT blocked_date, reason FROM property_calendar WHERE property_id = ? ORDER BY blocked_date',
        [id]
      );

      const allBlockedDates = Array.isArray(allBlockedDatesResult[0])
        ? allBlockedDatesResult[0]
        : allBlockedDatesResult;

      if (allBlockedDates.length > 0) {
        const icsData = await icsGeneratorService.generateICSFile(
          parseInt(id),
          property.property_number,
          allBlockedDates
        );

        await connection.query(
          `UPDATE property_ics 
           SET ics_url = ?, ics_filename = ?, ics_file_path = ?, 
               total_blocked_days = ?, updated_at = NOW()
           WHERE property_id = ?`,
          [icsData.url, icsData.filename, icsData.filepath, allBlockedDates.length, id]
        );
      } else {
        await connection.query('DELETE FROM property_ics WHERE property_id = ?', [id]);
      }
    }

    await connection.commit();

    logger.info(`External calendar removed: ${calendarId} from property ${id}`);

    res.json({
      success: true,
      message: 'Календарь успешно удален'
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Remove external calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления календаря'
    });
  }
}

/**
 * Переключить синхронизацию календаря
 * PATCH /api/properties/:id/external-calendars/:calendarId/toggle
 */
async toggleExternalCalendar(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id, calendarId } = req.params;
    const { is_enabled } = req.body;

    const calendar = await db.queryOne(
      'SELECT id FROM property_external_calendars WHERE id = ? AND property_id = ?',
      [calendarId, id]
    );

    if (!calendar) {
      res.status(404).json({
        success: false,
        message: 'Календарь не найден'
      });
      return;
    }

    await db.query(
      'UPDATE property_external_calendars SET is_enabled = ? WHERE id = ?',
      [is_enabled ? 1 : 0, calendarId]
    );

    logger.info(`External calendar ${calendarId} ${is_enabled ? 'enabled' : 'disabled'}`);

    res.json({
      success: true,
      message: `Синхронизация ${is_enabled ? 'включена' : 'отключена'}`
    });
  } catch (error) {
    logger.error('Toggle external calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка переключения синхронизации'
    });
  }
}

/**
 * Анализировать пересечения календарей
 * POST /api/properties/:id/external-calendars/analyze
 */
async analyzeExternalCalendars(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { calendar_ids } = req.body;

    if (!calendar_ids || !Array.isArray(calendar_ids) || calendar_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо указать календари для анализа'
      });
      return;
    }

    const analysis = await externalCalendarSyncService.analyzeCalendarConflicts(
      parseInt(id),
      calendar_ids
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    logger.error('Analyze external calendars error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка анализа календарей'
    });
  }
}

/**
 * Синхронизировать все внешние календари объекта
 * POST /api/properties/:id/external-calendars/sync
 */
async syncExternalCalendars(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();
  
  try {
    const { id } = req.params;

    // Получаем объект
    const propertyResult: any = await connection.query(
      'SELECT id, property_number FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    const properties = Array.isArray(propertyResult[0]) 
      ? propertyResult[0] 
      : propertyResult;

    const property = properties[0];

    if (!property) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Получаем все включенные внешние календари
    const calendarsResult: any = await connection.query(
      'SELECT * FROM property_external_calendars WHERE property_id = ? AND is_enabled = 1',
      [id]
    );

    const calendars = Array.isArray(calendarsResult[0]) 
      ? calendarsResult[0] 
      : [];

    if (calendars.length === 0) {
      await connection.rollback();
      res.json({
        success: true,
        message: 'Нет активных календарей для синхронизации',
        data: {
          syncedCalendars: 0,
          totalEvents: 0
        }
      });
      return;
    }

    let totalEvents = 0;
    let syncedCalendars = 0;

    for (const calendar of calendars) {
      try {
        const events = await externalCalendarSyncService.syncCalendar(
          connection,
          property.id,
          calendar.id,
          calendar.ics_url
        );

        totalEvents += events;
        syncedCalendars++;

        // Обновляем информацию о календаре
        await connection.query(
          `UPDATE property_external_calendars 
           SET last_sync_at = NOW(), 
               sync_error = NULL,
               total_events = ?
           WHERE id = ?`,
          [events, calendar.id]
        );

        logger.info(`Synced calendar ${calendar.id} for property ${id}: ${events} events`);
      } catch (error: any) {
        // Записываем ошибку синхронизации
        await connection.query(
          `UPDATE property_external_calendars 
           SET sync_error = ?
           WHERE id = ?`,
          [error.message || 'Unknown error', calendar.id]
        );

        logger.error(`Failed to sync calendar ${calendar.id}:`, error);
      }
    }

    // ВАЖНО: Генерируем объединенный ICS файл после синхронизации
    const allBlockedDatesResult: any = await connection.query(
      'SELECT blocked_date, reason FROM property_calendar WHERE property_id = ? ORDER BY blocked_date',
      [id]
    );

    const allBlockedDates = Array.isArray(allBlockedDatesResult[0]) 
      ? allBlockedDatesResult[0] 
      : [];

    const icsData = await icsGeneratorService.generateICSFile(
      property.id,
      property.property_number,
      allBlockedDates
    );

    await connection.query(
      `INSERT INTO property_ics (property_id, ics_url, ics_filename, ics_file_path, total_blocked_days)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         ics_url = VALUES(ics_url),
         ics_filename = VALUES(ics_filename),
         ics_file_path = VALUES(ics_file_path),
         total_blocked_days = VALUES(total_blocked_days),
         updated_at = NOW()`,
      [id, icsData.url, icsData.filename, icsData.filepath, allBlockedDates.length]
    );

    await connection.commit();

    logger.info(`External calendars sync completed for property ${id}: ${syncedCalendars} calendars, ${totalEvents} events`);

    res.json({
      success: true,
      message: 'Синхронизация завершена успешно',
      data: {
        syncedCalendars,
        totalEvents,
        icsUrl: icsData.url
      }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Sync external calendars error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка синхронизации внешних календарей'
    });
  }
}

/**
 * Проверка готовности к генерации описания
 */
async checkAIGenerationReadiness(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
  try {
    const propertyId = parseInt(req.params.id);

    const readiness = await aiDescriptionService.checkReadiness(propertyId);
    const rateLimit = await aiDescriptionService.checkRateLimit(propertyId);

    res.json({
      success: true,
      data: {
        ...readiness,
        rateLimit
      }
    });
  } catch (error) {
    logger.error('Check AI readiness error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка проверки готовности'
    });
  }
}

/**
 * Генерация описания с помощью AI
 */
async generateAIDescription(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
  try {
    const propertyId = parseInt(req.params.id);
    const userId = req.admin?.id;
    const { additionalPrompt } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Пользователь не авторизован'
      });
      return;
    }

    // Проверяем готовность
    const readiness = await aiDescriptionService.checkReadiness(propertyId);
    if (!readiness.ready) {
      res.status(400).json({
        success: false,
        message: 'Объект не готов для AI генерации',
        data: { checks: readiness.checks }
      });
      return;
    }

    // Проверяем rate limit
    const rateLimit = await aiDescriptionService.checkRateLimit(propertyId);
    if (!rateLimit.allowed) {
      res.status(429).json({
        success: false,
        message: `Пожалуйста, подождите еще ${Math.ceil(rateLimit.remainingSeconds / 60)} мин. перед повторной генерацией`,
        data: { remainingSeconds: rateLimit.remainingSeconds }
      });
      return;
    }

    // Генерируем описания
    const result = await aiDescriptionService.generateDescriptions(
      propertyId,
      userId,
      additionalPrompt
    );

    res.json({
      success: true,
      message: 'Описания успешно сгенерированы',
      data: result
    });
  } catch (error: any) {
    logger.error('Generate AI description error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка генерации описаний'
    });
  }
}

/**
 * Создать объект с помощью AI
 * POST /api/properties/create-with-ai
 */
async createWithAI(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Текст описания объекта не предоставлен'
      });
      return;
    }

    logger.info(`AI Property Creation requested by user ${req.admin?.username}`);
    logger.info(`Text length: ${text.length} characters`);

    // Парсим текст через AI
    const aiPropertyCreationService = (await import('../services/aiPropertyCreation.service')).default;
    const propertyData = await aiPropertyCreationService.parsePropertyFromText(text);

    logger.info('AI parsing completed');
    logger.info(`Property data extracted: ${JSON.stringify(propertyData, null, 2)}`);

    // ✅ ИСПРАВЛЕНИЕ: НЕ скачиваем фотографии здесь, просто возвращаем URL
    // Фотографии будут загружены при создании объекта через метод create

    // ✅ ПРАВИЛЬНО структурируем возвращаемые данные
    const responseData: any = {
      // Основная информация
      property_number: propertyData.property_number,
      property_name: propertyData.property_name,
      complex_name: propertyData.complex_name,
      deal_type: propertyData.deal_type,
      property_type: propertyData.property_type,
      region: propertyData.region,
      address: propertyData.address,
      google_maps_link: propertyData.google_maps_link,
      latitude: propertyData.latitude,
      longitude: propertyData.longitude,
      
      // Размеры
      bedrooms: propertyData.bedrooms,
      bathrooms: propertyData.bathrooms,
      indoor_area: propertyData.indoor_area,
      outdoor_area: propertyData.outdoor_area,
      plot_size: propertyData.plot_size,
      
      // Этажи и строительство
      floors: propertyData.floors,
      floor: propertyData.floor,
      construction_year: propertyData.construction_year,
      construction_month: propertyData.construction_month,
      
      // Дополнительно
      furniture_status: propertyData.furniture_status,
      parking_spaces: propertyData.parking_spaces,
      pets_allowed: propertyData.pets_allowed,
      
      // Реновация
      renovation_type: propertyData.renovation_type,
      renovation_date: propertyData.renovation_date,
      
      // Владение (для продажи)
      building_ownership: propertyData.building_ownership,
      land_ownership: propertyData.land_ownership,
      ownership_type: propertyData.ownership_type,
      
      // Цены
      sale_price: propertyData.sale_price,
      year_price: propertyData.year_price,
      
      // Комиссии
      sale_commission_type: propertyData.sale_commission_type,
      sale_commission_value: propertyData.sale_commission_value,
      rent_commission_type: propertyData.rent_commission_type,
      rent_commission_value: propertyData.rent_commission_value,
      
      // Владелец
      owner_name: propertyData.owner_name,
      owner_phone: propertyData.owner_phone,
      owner_email: propertyData.owner_email,
      owner_telegram: propertyData.owner_telegram,
      owner_instagram: propertyData.owner_instagram,
      owner_notes: propertyData.owner_notes,
      
      // Депозит и коммунальные
      deposit_type: propertyData.deposit_type,
      deposit_amount: propertyData.deposit_amount,
      electricity_rate: propertyData.electricity_rate,
      water_rate: propertyData.water_rate,
      rental_includes: propertyData.rental_includes,
      
      // Дополнительно
      video_url: propertyData.video_url,
      status: 'draft',
      
      // Особенности
      propertyFeatures: propertyData.propertyFeatures || [],
      outdoorFeatures: propertyData.outdoorFeatures || [],
      rentalFeatures: propertyData.rentalFeatures || [],
      locationFeatures: propertyData.locationFeatures || [],
      views: propertyData.views || [],
      
      // ✅ КРИТИЧЕСКИ ВАЖНО: Сезонные и месячные цены
      seasonalPricing: propertyData.seasonalPricing || [],
      monthlyPricing: propertyData.monthlyPricing || [],
      
      // ✅ КРИТИЧЕСКИ ВАЖНО: Заблокированные даты
      blockedDates: propertyData.blockedDates || [],
      
      // ✅ КРИТИЧЕСКИ ВАЖНО: Ссылка на Google Drive
      photosFromGoogleDrive: propertyData.photosFromGoogleDrive || null
    };

    // Логируем что получили
    if (propertyData.monthlyPricing && propertyData.monthlyPricing.length > 0) {
      logger.info(`✅ Extracted ${propertyData.monthlyPricing.length} monthly pricing entries`);
    }
    
    if (propertyData.blockedDates && propertyData.blockedDates.length > 0) {
      logger.info(`✅ Extracted ${propertyData.blockedDates.length} blocked dates`);
    }
    
    if (propertyData.photosFromGoogleDrive) {
      logger.info(`✅ Found Google Drive link: ${propertyData.photosFromGoogleDrive}`);
    }

    // Возвращаем данные для заполнения формы
    res.json({
      success: true,
      message: 'Данные объекта успешно извлечены из текста',
      data: responseData
    });

  } catch (error: any) {
    logger.error('Create with AI error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка создания объекта с помощью AI'
    });
  }
}

/**
 * Скачать фотографии с Google Drive используя API
 */
private async downloadPhotosFromGoogleDrive(
  googleDriveUrl: string
): Promise<Array<{ path: string; category: string }>> {
  const { google } = require('googleapis');
  const stream = require('stream');
  const { promisify } = require('util');
  const pipeline = promisify(stream.pipeline);
  
  // Извлекаем ID из URL
  const driveId = this.extractGoogleDriveId(googleDriveUrl);
  
  if (!driveId) {
    throw new Error('Не удалось извлечь ID из ссылки Google Drive');
  }

  logger.info(`Extracted Drive ID: ${driveId}`);

  try {
    // Загружаем credentials
    const credentialsPath = path.join(__dirname, '../../credentials/google-drive-credentials.json');
    
    if (!await fs.pathExists(credentialsPath)) {
      logger.warn('Google Drive credentials not found, falling back to gdown');
      return await this.downloadPhotosViaGdown(googleDriveUrl);
    }

    const credentials = require(credentialsPath);
    
    // Авторизуемся
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const drive = google.drive({ version: 'v3', auth });

    // Создаем временную папку
    const tempDownloadPath = path.join('/tmp', `gdrive_${driveId}_${Date.now()}`);
    await fs.ensureDir(tempDownloadPath);

    // Получаем список файлов
    const response = await drive.files.list({
      q: `'${driveId}' in parents and (mimeType contains 'image/')`,
      fields: 'files(id, name, mimeType)',
      pageSize: 1000
    });

    const files = response.data.files || [];
    logger.info(`Found ${files.length} images in Google Drive folder`);

    if (files.length === 0) {
      throw new Error('Не найдено изображений в папке Google Drive');
    }

    const downloadedPhotos: Array<{ path: string; category: string }> = [];

    // Скачиваем каждый файл
    for (const file of files) {
      try {
        const dest = path.join(tempDownloadPath, file.name);
        const destStream = fs.createWriteStream(dest);

        const res = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'stream' }
        );

        await pipeline(res.data, destStream);

        // Оптимизируем изображение
        const optimizedPath = await this.optimizeDownloadedImage(dest);
        
        downloadedPhotos.push({
          path: optimizedPath,
          category: 'general'
        });

        logger.info(`Downloaded and optimized: ${file.name}`);
      } catch (fileError) {
        logger.error(`Failed to download file ${file.name}:`, fileError);
        // Продолжаем со следующим файлом
      }
    }

    if (downloadedPhotos.length === 0) {
      throw new Error('Не удалось скачать ни одного изображения');
    }

    logger.info(`Successfully downloaded ${downloadedPhotos.length} photos`);
    return downloadedPhotos;

  } catch (error: any) {
    logger.error('Google Drive API error:', error);
    
    // Fallback на gdown если API не сработал
    logger.info('Falling back to gdown method...');
    return await this.downloadPhotosViaGdown(googleDriveUrl);
  }
}

/**
 * Fallback метод через gdown
 */
private async downloadPhotosViaGdown(
  googleDriveUrl: string
): Promise<Array<{ path: string; category: string }>> {
  const driveId = this.extractGoogleDriveId(googleDriveUrl);
  
  if (!driveId) {
    throw new Error('Не удалось извлечь ID из ссылки Google Drive');
  }

  const tempDownloadPath = path.join('/tmp', `gdrive_${driveId}_${Date.now()}`);
  await fs.ensureDir(tempDownloadPath);

  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const command = `gdown --folder https://drive.google.com/drive/folders/${driveId} -O "${tempDownloadPath}" --remaining-ok 2>&1`;
    
    const { stdout, stderr } = await execPromise(command, { 
      maxBuffer: 50 * 1024 * 1024,
      timeout: 300000 
    });
    
    logger.info('gdown stdout:', stdout);
    if (stderr) logger.warn('gdown stderr:', stderr);

    // Проверяем загруженные файлы
    const downloadedPhotos: Array<{ path: string; category: string }> = [];
    
    const processDirectory = async (dirPath: string): Promise<void> => {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          await processDirectory(fullPath);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
          
          if (imageExtensions.includes(ext)) {
            try {
              const optimizedPath = await this.optimizeDownloadedImage(fullPath);
              downloadedPhotos.push({
                path: optimizedPath,
                category: 'general'
              });
            } catch (optimizeError) {
              logger.error(`Failed to optimize image ${item.name}:`, optimizeError);
            }
          }
        }
      }
    };

    await processDirectory(tempDownloadPath);

    if (downloadedPhotos.length === 0) {
      throw new Error('Не найдено изображений в папке Google Drive');
    }

    return downloadedPhotos;

  } catch (error) {
    logger.error('Gdown error:', error);
    await fs.remove(tempDownloadPath).catch(() => {});
    throw new Error('Не удалось загрузить файлы из Google Drive. Убедитесь, что папка имеет доступ "Для всех, у кого есть ссылка"');
  }
}

/**
 * ✅ НОВОЕ: Оптимизация загруженного изображения до FullHD
 */
private async optimizeDownloadedImage(imagePath: string): Promise<string> {
  const sharp = require('sharp');
  
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    logger.info(`Original image size: ${metadata.width}x${metadata.height}`);
    
    // Если изображение больше FullHD - сжимаем с сохранением пропорций
    const maxWidth = 1920;
    const maxHeight = 1080;
    
    let needsResize = false;
    let resizeOptions: any = {};
    
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        needsResize = true;
        
        // Определяем ориентацию
        const isLandscape = metadata.width > metadata.height;
        
        if (isLandscape) {
          // Горизонтальная - ограничиваем по ширине
          resizeOptions = {
            width: maxWidth,
            height: null,
            fit: 'inside',
            withoutEnlargement: true
          };
        } else {
          // Вертикальная - ограничиваем по высоте
          resizeOptions = {
            width: null,
            height: maxHeight,
            fit: 'inside',
            withoutEnlargement: true
          };
        }
      }
    }
    
    if (needsResize) {
      const optimizedPath = imagePath.replace(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i, '_optimized.jpg');
      
      await sharp(imagePath)
        .resize(resizeOptions)
        .jpeg({ quality: 85, progressive: true })
        .toFile(optimizedPath);
      
      const newMetadata = await sharp(optimizedPath).metadata();
      logger.info(`Optimized image size: ${newMetadata.width}x${newMetadata.height}`);
      
      // Удаляем оригинал
      await fs.remove(imagePath);
      
      return optimizedPath;
    } else {
      // Изображение уже подходящего размера - просто конвертируем в JPEG если нужно
      const ext = path.extname(imagePath).toLowerCase();
      if (ext !== '.jpg' && ext !== '.jpeg') {
        const jpegPath = imagePath.replace(/\.[^.]+$/, '.jpg');
        await sharp(imagePath)
          .jpeg({ quality: 85, progressive: true })
          .toFile(jpegPath);
        
        await fs.remove(imagePath);
        return jpegPath;
      }
      
      return imagePath;
    }
  } catch (error) {
    logger.error('Image optimization error:', error);
    throw error;
  }
}



/**
 * Извлечь ID из ссылки Google Drive
 */
private extractGoogleDriveId(url: string): string | null {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{25,})$/
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
 * Сохранить объект с фотографиями из AI
 * POST /api/properties/save-from-ai
 */
async saveFromAI(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();
  
  try {
    const { propertyData, photosData } = req.body;
    const userId = req.admin!.id;

    if (!propertyData) {
      await db.rollback(connection);
      res.status(400).json({
        success: false,
        message: 'Данные объекта не предоставлены'
      });
      return;
    }

    logger.info(`Saving property from AI by user ${req.admin?.username}`);

    // Создаем объект недвижимости
  const propertyResult = await connection.query(
    `INSERT INTO properties (
      property_number, property_name, complex_name, deal_type, property_type,
      region, address, google_maps_link, latitude, longitude,
      bedrooms, bathrooms, indoor_area, outdoor_area, plot_size,
      floors, floor, construction_year, construction_month,
      furniture_status, parking_spaces, pets_allowed,
      building_ownership, land_ownership, ownership_type,
      sale_price, year_price, 
      sale_commission_type, sale_commission_value,
      rent_commission_type, rent_commission_value,
      renovation_type, renovation_date,
      status, created_by,
      owner_name, owner_phone, owner_email, owner_telegram, owner_instagram, owner_notes,
      deposit_type, deposit_amount, electricity_rate, water_rate, rental_includes,
      video_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      propertyData.property_number,
      propertyData.property_name,
      propertyData.complex_name,
      propertyData.deal_type,
      propertyData.property_type,
      propertyData.region,
      propertyData.address,
      propertyData.google_maps_link,
      propertyData.latitude,
      propertyData.longitude,
      propertyData.bedrooms,
      propertyData.bathrooms,
      propertyData.indoor_area,
      propertyData.outdoor_area,
      propertyData.plot_size,
      propertyData.floors,
      propertyData.floor,
      propertyData.construction_year,
      propertyData.construction_month,
      propertyData.furniture_status,
      propertyData.parking_spaces,
      propertyData.pets_allowed || 'yes',
      propertyData.building_ownership,
      propertyData.land_ownership,
      propertyData.ownership_type,
      propertyData.sale_price,
      propertyData.year_price,
      propertyData.sale_commission_type,
      propertyData.sale_commission_value,
      propertyData.rent_commission_type,
      propertyData.rent_commission_value,
      propertyData.renovation_type,
      propertyData.renovation_date,
      'draft',
      userId,
      propertyData.owner_name,
      propertyData.owner_phone,
      propertyData.owner_email,
      propertyData.owner_telegram,
      propertyData.owner_instagram,
      propertyData.owner_notes,
      propertyData.deposit_type,
      propertyData.deposit_amount,
      propertyData.electricity_rate,
      propertyData.water_rate,
      propertyData.rental_includes,
      propertyData.video_url
    ]
  );

    const propertyId = (propertyResult as any)[0].insertId;
    logger.info(`Property created with ID: ${propertyId}`);

    // Добавляем property_name в переводы
    const languages = ['ru', 'en', 'th', 'zh', 'he'];
    if (propertyData.property_name) {
      for (const lang of languages) {
        await connection.query(
          `INSERT INTO property_translations 
           (property_id, language_code, property_name, description, created_at, updated_at) 
           VALUES (?, ?, ?, '', NOW(), NOW())`,
          [propertyId, lang, propertyData.property_name]
        );
      }
    }

    // Добавляем особенности
    const featureTypes: { [key: string]: string } = {
      propertyFeatures: 'property',
      outdoorFeatures: 'outdoor',
      rentalFeatures: 'rental',
      locationFeatures: 'location',
      views: 'view'
    };

    for (const [key, type] of Object.entries(featureTypes)) {
      const featuresArray = propertyData[key];
      if (featuresArray && Array.isArray(featuresArray)) {
        for (const feature of featuresArray) {
          await connection.query(
            `INSERT INTO property_features (property_id, feature_type, feature_value)
             VALUES (?, ?, ?)`,
            [propertyId, type, feature]
          );
        }
      }
    }

    // Добавляем сезонные цены
    if (propertyData.seasonalPricing && Array.isArray(propertyData.seasonalPricing)) {
      for (const price of propertyData.seasonalPricing) {
        await connection.query(
          `INSERT INTO property_pricing (
            property_id, season_type, start_date_recurring, end_date_recurring,
            price_per_night, minimum_nights, pricing_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            propertyId,
            price.season_type || null,
            price.start_date_recurring,
            price.end_date_recurring,
            price.price_per_night,
            price.minimum_nights || 1,
            price.pricing_type || 'perPeriod'
          ]
        );
      }
    }

    // Добавляем месячные цены
    if (propertyData.monthlyPricing && Array.isArray(propertyData.monthlyPricing)) {
      for (const price of propertyData.monthlyPricing) {
        await connection.query(
          `INSERT INTO property_pricing_monthly (
            property_id, month_number, price_per_month, minimum_days
          ) VALUES (?, ?, ?, ?)`,
          [
            propertyId,
            price.month_number,
            price.price_per_month,
            price.minimum_days || 1
          ]
        );
      }
    }

    // Добавляем заблокированные даты в календарь
    if (propertyData.blockedDates && Array.isArray(propertyData.blockedDates)) {
      for (const blocked of propertyData.blockedDates) {
        await connection.query(
          `INSERT INTO property_calendar (property_id, blocked_date, reason)
           VALUES (?, ?, ?)`,
          [propertyId, blocked.blocked_date, blocked.reason || 'Unknown']
        );
      }
    }

    // Обрабатываем фотографии (если были загружены из Google Drive)
    if (photosData && Array.isArray(photosData) && photosData.length > 0) {
      const uploadsPath = '/var/www/www-root/data/www/novaestate.company/backend/uploads';
      const propertyPhotosPath = path.join(uploadsPath, 'properties', String(propertyId));
      await fs.ensureDir(propertyPhotosPath);

      let sortOrder = 0;
      for (const photoData of photosData) {
        if (photoData.tempPath && await fs.pathExists(photoData.tempPath)) {
          const fileName = `photo_${Date.now()}_${sortOrder}.jpg`;
          const finalPath = path.join(propertyPhotosPath, fileName);
          
          // Копируем и обрабатываем изображение
          await fs.copy(photoData.tempPath, finalPath);
          
          // Сжимаем изображение
          const sharp = require('sharp');
          await sharp(finalPath)
            .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, progressive: true })
            .toFile(finalPath + '.tmp');
                  
          await fs.move(finalPath + '.tmp', finalPath, { overwrite: true });

          const relativePath = `/uploads/properties/${propertyId}/${fileName}`;

          // Добавляем в БД
          await connection.query(
            `INSERT INTO property_photos (
              property_id, photo_url, category, sort_order, is_primary
            ) VALUES (?, ?, ?, ?, ?)`,
            [
              propertyId,
              relativePath,
              photoData.category || 'general',
              sortOrder,
              sortOrder === 0 ? 1 : 0
            ]
          );

          sortOrder++;
        }
      }

      logger.info(`Added ${sortOrder} photos for property ${propertyId}`);
    }

    await db.commit(connection);

    logger.info(`Property ${propertyId} created successfully from AI`);

    res.json({
      success: true,
      message: 'Объект успешно создан',
      data: {
        propertyId
      }
    });

  } catch (error: any) {
    await db.rollback(connection);
    logger.error('Save from AI error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка сохранения объекта'
    });
  }
}


/**
 * Генерация HTML презентации объекта
 * POST /api/properties/:id/generate-html
 */
async generateHTML(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      language,
      displayMode,
      showRentalPrices,
      showSalePrices,
      includeSeasonalPrices,
      includeMonthlyPrices,
      includeYearlyPrice,
      forAgent,
      // ✅ Параметры наценок
      yearlyPriceMarkup,
      seasonalPricesMarkup,
      monthlyPricesMarkup,
      salePriceMarkup
    } = req.body;

    // Валидация displayMode
    if (displayMode && !['rent', 'sale', 'both'].includes(displayMode)) {
      res.status(400).json({
        success: false,
        message: 'Неверный displayMode. Допустимые значения: rent, sale, both'
      });
      return;
    }

    // Проверяем существование объекта и получаем deal_type
    const property = await db.queryOne<any>(
      'SELECT id, deal_type FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Определяем displayMode автоматически если не указан
    let finalDisplayMode = displayMode;
    
    if (!finalDisplayMode) {
      // Если не указан - берем из deal_type объекта
      finalDisplayMode = property.deal_type || 'rent';
    } else {
      // Проверяем совместимость displayMode с deal_type объекта
      if (property.deal_type === 'rent' && displayMode === 'sale') {
        res.status(400).json({
          success: false,
          message: 'Этот объект только для аренды, нельзя сгенерировать HTML для продажи'
        });
        return;
      }
      
      if (property.deal_type === 'sale' && displayMode === 'rent') {
        res.status(400).json({
          success: false,
          message: 'Этот объект только для продажи, нельзя сгенерировать HTML для аренды'
        });
        return;
      }
    }

    // Импортируем сервис
    const htmlGeneratorService = (await import('../services/htmlGenerator.service')).default;

    // Генерируем HTML
    const html = await htmlGeneratorService.generatePropertyHTML(
      parseInt(id),
      {
        language: language || 'ru',
        displayMode: finalDisplayMode,
        showRentalPrices: showRentalPrices !== false,
        showSalePrices: showSalePrices !== false, // ✅ ИЗМЕНЕНО: !== false вместо === true
        includeSeasonalPrices: includeSeasonalPrices !== false,
        includeMonthlyPrices: includeMonthlyPrices !== false,
        includeYearlyPrice: includeYearlyPrice !== false,
        forAgent: forAgent === true,
        // ✅ Передаем наценки
        yearlyPriceMarkup,
        seasonalPricesMarkup,
        monthlyPricesMarkup,
        salePriceMarkup
      }
    );

    logger.info(`HTML generated for property ${id} (displayMode: ${finalDisplayMode}) by user ${req.admin?.username}`);

    // Отправляем HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (error: any) {
    logger.error('Generate HTML error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка генерации HTML'
    });
  }
}
async getPropertyPrices(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Проверяем существование объекта
    const property = await db.queryOne<any>(
      'SELECT id, year_price, sale_price, deal_type FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // ✅ ИСПРАВЛЕНО: Получаем сезонные цены правильно
    const seasonalPricesResult: any = await db.query(
      `SELECT id, pricing_type, price_per_night, source_price_per_night,
              start_date_recurring, end_date_recurring, minimum_nights
       FROM property_pricing 
       WHERE property_id = ? 
       ORDER BY start_date_recurring ASC`,
      [id]
    );

    // ✅ Берем только первый элемент массива (rows)
    const seasonalPricesRaw = Array.isArray(seasonalPricesResult[0]) 
      ? seasonalPricesResult[0] 
      : seasonalPricesResult;

    // ✅ Преобразуем цены в числа
    const seasonalPrices = seasonalPricesRaw.map((price: any) => ({
      ...price,
      price_per_night: price.price_per_night ? parseFloat(price.price_per_night) : null,
      source_price_per_night: price.source_price_per_night ? parseFloat(price.source_price_per_night) : null,
      minimum_nights: price.minimum_nights ? parseInt(price.minimum_nights) : null
    }));

    // ✅ ИСПРАВЛЕНО: Получаем месячные цены правильно
    const monthlyPricesResult: any = await db.query(
      `SELECT month_number, price_per_month, minimum_days
       FROM property_pricing_monthly 
       WHERE property_id = ? 
       ORDER BY month_number ASC`,
      [id]
    );

    // ✅ Берем только первый элемент массива (rows)
    const monthlyPricesRaw = Array.isArray(monthlyPricesResult[0]) 
      ? monthlyPricesResult[0] 
      : monthlyPricesResult;

    // ✅ Преобразуем цены в числа
    const monthlyPrices = monthlyPricesRaw.map((price: any) => ({
      month_number: parseInt(price.month_number),
      price_per_month: parseFloat(price.price_per_month),
      minimum_days: price.minimum_days ? parseInt(price.minimum_days) : null
    }));

    // ✅ Добавляем deal_type в ответ и преобразуем цены в числа
    res.json({
      success: true,
      data: {
        dealType: property.deal_type,
        yearlyPrice: property.year_price ? parseFloat(property.year_price) : null,
        seasonalPrices,
        monthlyPrices,
        salePrice: property.sale_price ? parseFloat(property.sale_price) : null
      }
    });

  } catch (error: any) {
    logger.error('Get property prices error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения цен'
    });
  }
}

}

export default new PropertiesController();