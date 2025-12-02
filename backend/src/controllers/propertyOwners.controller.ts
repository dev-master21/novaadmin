// backend/src/controllers/propertyOwners.controller.ts
import { Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';
import { generatePreviewUrl } from '../utils/previewToken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const OWNER_ACCESS_TOKEN_EXPIRY = '2h'; // Access token на 2 часа
const OWNER_REFRESH_TOKEN_EXPIRY = '30d'; // Refresh token на 30 дней

interface OwnerTokenPayload {
  id: number;
  owner_name: string;
  type: 'owner';
}

class PropertyOwnersController {
  
  /**
   * Генерация случайного пароля
   */
  private generatePassword(length: number = 10): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Генерация уникального токена для URL
   */
  private generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Генерация JWT токенов для владельца
   */
  private generateOwnerTokens(payload: OwnerTokenPayload) {
    const accessToken = jwt.sign(payload, JWT_SECRET, { 
      expiresIn: OWNER_ACCESS_TOKEN_EXPIRY 
    });
    
    const refreshToken = jwt.sign(payload, JWT_SECRET, { 
      expiresIn: OWNER_REFRESH_TOKEN_EXPIRY 
    });
    
    return { accessToken, refreshToken };
  }

  /**
   * Создать доступ для владельца
   * POST /api/property-owners/create
   */
  async createOwnerAccess(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { owner_name, can_edit_calendar = true, can_edit_pricing = true } = req.body;
      const adminId = req.admin!.id;

      if (!owner_name || !owner_name.trim()) {
        res.status(400).json({
          success: false,
          message: 'Имя владельца обязательно'
        });
        return;
      }

      // Проверяем существует ли уже доступ для этого владельца
      const existingOwner = await db.queryOne<any>(
        'SELECT * FROM property_owners WHERE owner_name = ?',
        [owner_name.trim()]
      );

      if (existingOwner) {
        res.status(400).json({
          success: false,
          message: 'Доступ для этого владельца уже создан',
          data: {
            access_token: existingOwner.access_token,
            initial_password: existingOwner.current_password || existingOwner.initial_password,
            created_at: existingOwner.created_at,
            can_edit_calendar: !!existingOwner.can_edit_calendar,
            can_edit_pricing: !!existingOwner.can_edit_pricing
          }
        });
        return;
      }

      // Проверяем есть ли объекты с таким именем владельца
      const propertiesCount = await db.queryOne<any>(
        'SELECT COUNT(*) as count FROM properties WHERE owner_name = ? AND deleted_at IS NULL',
        [owner_name.trim()]
      );

      if (!propertiesCount || propertiesCount.count === 0) {
        res.status(400).json({
          success: false,
          message: 'Не найдено объектов с таким именем владельца'
        });
        return;
      }

      // Генерируем данные
      const accessToken = this.generateAccessToken();
      const initialPassword = this.generatePassword(10);
      const passwordHash = await bcrypt.hash(initialPassword, 10);

      // Создаём запись в БД с разрешениями
      await db.query(
        `INSERT INTO property_owners 
         (owner_name, access_token, password_hash, initial_password, current_password, created_by, can_edit_calendar, can_edit_pricing) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          owner_name.trim(), 
          accessToken, 
          passwordHash, 
          initialPassword, 
          initialPassword, 
          adminId,
          can_edit_calendar ? 1 : 0,
          can_edit_pricing ? 1 : 0
        ]
      );

      logger.info(`Owner access created for ${owner_name} by admin ${req.admin?.username} with permissions: calendar=${can_edit_calendar}, pricing=${can_edit_pricing}`);

      res.json({
        success: true,
        message: 'Доступ для владельца успешно создан',
        data: {
          owner_name: owner_name.trim(),
          access_url: `https://owner.novaestate.company/owner/${accessToken}`,
          password: initialPassword,
          properties_count: propertiesCount.count,
          can_edit_calendar: !!can_edit_calendar,
          can_edit_pricing: !!can_edit_pricing
        }
      });
    } catch (error) {
      logger.error('Create owner access error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания доступа для владельца'
      });
    }
  }

  /**
   * Проверить токен владельца и получить информацию
   * GET /api/property-owners/verify/:token
   */
  async verifyOwnerToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const owner = await db.queryOne<any>(
        `SELECT id, owner_name, access_token, is_active, last_login_at, can_edit_calendar, can_edit_pricing 
         FROM property_owners 
         WHERE access_token = ? AND is_active = 1`,
        [token]
      );

      if (!owner) {
        res.status(404).json({
          success: false,
          message: 'Доступ не найден или деактивирован'
        });
        return;
      }

      // Получаем количество объектов
      const propertiesCount = await db.queryOne<any>(
        'SELECT COUNT(*) as count FROM properties WHERE owner_name = ? AND deleted_at IS NULL',
        [owner.owner_name]
      );

      res.json({
        success: true,
        data: {
          owner_name: owner.owner_name,
          properties_count: propertiesCount?.count || 0,
          last_login_at: owner.last_login_at,
          can_edit_calendar: !!owner.can_edit_calendar,
          can_edit_pricing: !!owner.can_edit_pricing
        }
      });
    } catch (error) {
      logger.error('Verify owner token error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка проверки токена'
      });
    }
  }

  /**
   * Авторизация владельца
   * POST /api/property-owners/login
   */
  async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { access_token, password } = req.body;

      if (!access_token || !password) {
        res.status(400).json({
          success: false,
          message: 'Токен и пароль обязательны'
        });
        return;
      }

      // Ищем владельца с разрешениями
      const owner = await db.queryOne<any>(
        `SELECT id, owner_name, access_token, password_hash, is_active, can_edit_calendar, can_edit_pricing 
         FROM property_owners 
         WHERE access_token = ?`,
        [access_token]
      );

      if (!owner) {
        res.status(401).json({
          success: false,
          message: 'Неверный токен или пароль'
        });
        return;
      }

      if (!owner.is_active) {
        res.status(403).json({
          success: false,
          message: 'Доступ деактивирован. Свяжитесь с администратором'
        });
        return;
      }

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(password, owner.password_hash);

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Неверный токен или пароль'
        });
        return;
      }

      // Генерируем JWT токены
      const tokenPayload: OwnerTokenPayload = {
        id: owner.id,
        owner_name: owner.owner_name,
        type: 'owner'
      };

      const { accessToken: jwtAccessToken, refreshToken } = this.generateOwnerTokens(tokenPayload);

      // Сохраняем refresh token в БД
      await db.query(
        `INSERT INTO property_owner_refresh_tokens (owner_id, token, expires_at) 
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [owner.id, refreshToken]
      );

      // Обновляем время последнего входа
      await db.query(
        'UPDATE property_owners SET last_login_at = NOW() WHERE id = ?',
        [owner.id]
      );

      // Получаем количество объектов
      const propertiesCount = await db.queryOne<any>(
        'SELECT COUNT(*) as count FROM properties WHERE owner_name = ? AND deleted_at IS NULL',
        [owner.owner_name]
      );

      logger.info(`Owner ${owner.owner_name} logged in successfully`);

      res.json({
        success: true,
        data: {
          owner: {
            id: owner.id,
            owner_name: owner.owner_name,
            access_token: owner.access_token,
            properties_count: propertiesCount?.count || 0,
            can_edit_calendar: !!owner.can_edit_calendar,
            can_edit_pricing: !!owner.can_edit_pricing
          },
          accessToken: jwtAccessToken,
          refreshToken: refreshToken
        }
      });
    } catch (error) {
      logger.error('Owner login error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка авторизации'
      });
    }
  }

  /**
   * Обновление токена владельца
   * POST /api/property-owners/refresh
   */
  async refreshToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token обязателен'
        });
        return;
      }

      // Проверяем токен
      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, JWT_SECRET) as OwnerTokenPayload;
      } catch (error) {
        res.status(401).json({
          success: false,
          message: 'Недействительный refresh token'
        });
        return;
      }

      // Проверяем существование токена в БД
      const tokenRecord = await db.queryOne<any>(
        `SELECT ot.*, o.owner_name, o.is_active 
         FROM property_owner_refresh_tokens ot
         JOIN property_owners o ON ot.owner_id = o.id
         WHERE ot.token = ? AND ot.expires_at > NOW()`,
        [refreshToken]
      );

      if (!tokenRecord || !tokenRecord.is_active) {
        res.status(401).json({
          success: false,
          message: 'Refresh token недействителен или доступ деактивирован'
        });
        return;
      }

      // Генерируем новые токены
      const tokenPayload: OwnerTokenPayload = {
        id: decoded.id,
        owner_name: decoded.owner_name,
        type: 'owner'
      };

      const { accessToken, refreshToken: newRefreshToken } = this.generateOwnerTokens(tokenPayload);

      // Удаляем старый refresh token
      await db.query(
        'DELETE FROM property_owner_refresh_tokens WHERE token = ?',
        [refreshToken]
      );

      // Сохраняем новый refresh token
      await db.query(
        `INSERT INTO property_owner_refresh_tokens (owner_id, token, expires_at) 
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [decoded.id, newRefreshToken]
      );

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      logger.error('Owner refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления токена'
      });
    }
  }

  /**
   * Смена пароля владельцем
   * POST /api/property-owners/change-password
   */
  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { current_password, new_password } = req.body;
      const ownerId = (req as any).owner?.id;

      if (!ownerId) {
        res.status(401).json({
          success: false,
          message: 'Не авторизован'
        });
        return;
      }

      if (!current_password || !new_password) {
        res.status(400).json({
          success: false,
          message: 'Текущий и новый пароль обязательны'
        });
        return;
      }

      if (new_password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Новый пароль должен содержать минимум 6 символов'
        });
        return;
      }

      // Получаем данные владельца
      const owner = await db.queryOne<any>(
        'SELECT id, password_hash FROM property_owners WHERE id = ?',
        [ownerId]
      );

      if (!owner) {
        res.status(404).json({
          success: false,
          message: 'Владелец не найден'
        });
        return;
      }

      // Проверяем текущий пароль
      const isPasswordValid = await bcrypt.compare(current_password, owner.password_hash);

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Неверный текущий пароль'
        });
        return;
      }

      // Хешируем новый пароль
      const newPasswordHash = await bcrypt.hash(new_password, 10);

      // Обновляем пароль
      await db.query(
        'UPDATE property_owners SET password_hash = ?, current_password = ? WHERE id = ?',
        [newPasswordHash, new_password, ownerId]
      );

      logger.info(`Owner ${ownerId} changed password`);

      res.json({
        success: true,
        message: 'Пароль успешно изменён'
      });
    } catch (error) {
      logger.error('Owner change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка смены пароля'
      });
    }
  }

  /**
   * Получить список объектов владельца с детальной заполненностью
   * GET /api/property-owners/properties
   */
  async getOwnerProperties(req: AuthRequest, res: Response) {
    try {
      const owner = (req as any).owner;
      
      if (!owner || !owner.id || !owner.owner_name) {
        logger.error('Owner data not found in request:', owner);
        res.status(401).json({
          success: false,
          message: 'Не авторизован'
        });
        return;
      }

      const ownerId = owner.id;
      const ownerName = owner.owner_name;

      logger.info(`Loading properties for owner: ${ownerName} (ID: ${ownerId})`);

      const propertiesResult: any = await db.query(
        `SELECT 
          p.id,
          p.property_number,
          p.property_name,
          p.deal_type,
          p.bedrooms,
          p.bathrooms,
          p.sale_price,
          p.year_price,
          p.deposit_type,
          p.deposit_amount,
          p.electricity_rate,
          p.water_rate,
          p.sale_commission_type,
          p.rent_commission_type,
          (SELECT photo_url FROM property_photos WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as cover_photo
        FROM properties p
        WHERE p.owner_name = ? AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC`,
        [ownerName]
      );

      let properties: any[];
      if (Array.isArray(propertiesResult)) {
        properties = propertiesResult;
      } else if (propertiesResult && Array.isArray(propertiesResult[0])) {
        properties = propertiesResult[0];
      } else if (propertiesResult && (propertiesResult as any).rows) {
        properties = (propertiesResult as any).rows;
      } else {
        logger.error('Unexpected query result format:', propertiesResult);
        res.status(500).json({
          success: false,
          message: 'Unexpected database response format'
        });
        return;
      }

      logger.info(`Found ${properties.length} properties for owner ${ownerName}`);

      if (!Array.isArray(properties)) {
        logger.error('Properties is not an array:', properties);
        res.status(500).json({
          success: false,
          message: 'Invalid properties data'
        });
        return;
      }

      const propertiesWithDetails = await Promise.all(
        properties.map(async (property) => {
          try {
            // Получаем фотографии
            const photosResult: any = await db.query(
              `SELECT photo_url FROM property_photos 
               WHERE property_id = ? 
               ORDER BY is_primary DESC, id ASC 
               LIMIT 5`,
              [property.id]
            );
            const photos = Array.isArray(photosResult) ? photosResult : 
                          Array.isArray(photosResult[0]) ? photosResult[0] : 
                          (photosResult as any).rows || [];

            // Получаем количество сезонных цен
            const seasonalResult: any = await db.query(
              `SELECT COUNT(*) as count
               FROM property_pricing 
               WHERE property_id = ? AND price_per_night > 0`,
              [property.id]
            );
            let seasonalCount = 0;
            if (Array.isArray(seasonalResult)) {
              seasonalCount = seasonalResult[0]?.count || 0;
            } else if (Array.isArray(seasonalResult[0])) {
              seasonalCount = seasonalResult[0][0]?.count || 0;
            } else if ((seasonalResult as any).count !== undefined) {
              seasonalCount = seasonalResult.count;
            }

            // Получаем ДЕТАЛЬНУЮ информацию о месячных ценах
            const monthlyPricingResult: any = await db.query(
              `SELECT 
                month_number as month, 
                price_per_month as price, 
                source_price
               FROM property_pricing_monthly 
               WHERE property_id = ?
               ORDER BY month_number`,
              [property.id]
            );
            
            let monthlyPricing: any[] = [];
            if (Array.isArray(monthlyPricingResult)) {
              monthlyPricing = monthlyPricingResult;
            } else if (Array.isArray(monthlyPricingResult[0])) {
              monthlyPricing = monthlyPricingResult[0];
            } else if ((monthlyPricingResult as any).rows) {
              monthlyPricing = (monthlyPricingResult as any).rows;
            }

            // Создаём детальную информацию о всех 12 месяцах
            const monthlyPricesDetails = [];
            for (let month = 1; month <= 12; month++) {
              const monthData = monthlyPricing.find(m => m.month === month);
              monthlyPricesDetails.push({
                month: month,
                price: monthData?.price || null,
                source_price: monthData?.source_price || null,
                is_filled: !!(monthData?.source_price && monthData.source_price > 0)
              });
            }

            const monthlyFilledCount = monthlyPricesDetails.filter(m => m.is_filled).length;

            // Получаем заблокированные даты
            const blockedResult: any = await db.query(
              `SELECT blocked_date FROM property_calendar 
               WHERE property_id = ? AND blocked_date >= CURDATE()
               ORDER BY blocked_date ASC`,
              [property.id]
            );
            const blockedDates = Array.isArray(blockedResult) ? blockedResult : 
                                Array.isArray(blockedResult[0]) ? blockedResult[0] : 
                                (blockedResult as any).rows || [];

            let nearestBlockedPeriod = null;
            if (blockedDates.length > 0) {
              const firstDate = blockedDates[0].blocked_date;
              let endDate = firstDate;
              
              for (let i = 1; i < blockedDates.length; i++) {
                const currentDate = new Date(blockedDates[i].blocked_date);
                const prevDate = new Date(blockedDates[i - 1].blocked_date);
                const diffDays = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
                
                if (diffDays === 1) {
                  endDate = blockedDates[i].blocked_date;
                } else {
                  break;
                }
              }

              nearestBlockedPeriod = {
                start_date: firstDate,
                end_date: endDate
              };
            }

            // ✅ НОВЫЙ РАСЧЕТ ЗАПОЛНЕННОСТИ
            const completenessData = this.calculatePropertyCompleteness(
              property,
              seasonalCount,
              monthlyFilledCount,
              blockedDates.length > 0
            );

            return {
              id: property.id,
              property_number: property.property_number,
              property_name: property.property_name,
              deal_type: property.deal_type,
              bedrooms: property.bedrooms || 0,
              bathrooms: property.bathrooms || 0,
              cover_photo: property.cover_photo ? `https://admin.novaestate.company${property.cover_photo}` : null,
              photos: photos.map((p: any) => ({ url: `https://admin.novaestate.company${p.photo_url}` })),
              completeness: completenessData.completeness,
              completeness_details: {
                filled: completenessData.filled,
                missing: completenessData.missing,
                monthly_prices: monthlyPricesDetails
              },
              nearest_blocked_period: nearestBlockedPeriod,
              has_blocked_dates: blockedDates.length > 0
            };
          } catch (propertyError) {
            logger.error(`Error processing property ${property.id}:`, propertyError);
            return {
              id: property.id,
              property_number: property.property_number,
              property_name: property.property_name,
              deal_type: property.deal_type,
              bedrooms: property.bedrooms || 0,
              bathrooms: property.bathrooms || 0,
              cover_photo: property.cover_photo ? `https://admin.novaestate.company${property.cover_photo}` : null,
              photos: [],
              completeness: 0,
              completeness_details: {
                filled: [],
                missing: [],
                monthly_prices: []
              },
              nearest_blocked_period: null,
              has_blocked_dates: false
            };
          }
        })
      );

      res.json({
        success: true,
        data: propertiesWithDetails
      });
    } catch (error) {
      logger.error('Get owner properties error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get properties',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Рассчитать заполненность объекта для владельца
   */
  private calculatePropertyCompleteness(
    property: any,
    _seasonalCount: number,
    monthlyFilledCount: number,
    hasBlockedDates: boolean
  ): {
    completeness: number;
    filled: Array<{ name: string; is_filled: boolean; field_key: string }>;
    missing: Array<{ name: string; is_filled: boolean; field_key: string }>;
  } {
    const dealType = property.deal_type;
    const fields: Array<{
      key: string;
      name: string;
      check: () => boolean;
    }> = [];

    // Поля для продажи
    if (dealType === 'sale' || dealType === 'both') {
      fields.push({
        key: 'sale_price',
        name: 'Цена продажи',
        check: () => property.sale_price !== null && property.sale_price > 0
      });
    }

    // Поля для аренды
    if (dealType === 'rent' || dealType === 'both') {
      fields.push(
        {
          key: 'year_price',
          name: 'Цена годовой аренды',
          check: () => property.year_price !== null && property.year_price > 0
        },
        {
          key: 'monthly_prices',
          name: 'Месячные цены (не все месяцы)',
          check: () => monthlyFilledCount > 0
        },
        {
          key: 'calendar',
          name: 'Календарь занятости',
          check: () => hasBlockedDates
        },
        {
          key: 'commission',
          name: 'Комиссия (аренда)',
          check: () => property.rent_commission_type !== null
        },
        {
          key: 'deposit',
          name: 'Депозит',
          check: () => property.deposit_type !== null && property.deposit_amount !== null && property.deposit_amount > 0
        },
        {
          key: 'utilities',
          name: 'Коммунальные услуги (электричество, вода)',
          check: () => {
            const hasElectricity = property.electricity_rate !== null && property.electricity_rate > 0;
            const hasWater = property.water_rate !== null && property.water_rate > 0;
            return hasElectricity && hasWater;
          }
        }
      );
    }

    // Проверяем все поля
    const filled: Array<{ name: string; is_filled: boolean; field_key: string }> = [];
    const missing: Array<{ name: string; is_filled: boolean; field_key: string }> = [];

    fields.forEach(field => {
      const isFilled = field.check();
      const fieldData = {
        name: field.name,
        is_filled: isFilled,
        field_key: field.key
      };

      if (isFilled) {
        filled.push(fieldData);
      } else {
        missing.push(fieldData);
      }
    });

    // Рассчитываем процент заполненности
    const completeness = fields.length > 0 
      ? Math.round((filled.length / fields.length) * 100) 
      : 0;

    return {
      completeness,
      filled,
      missing
    };
  }

  /**
   * Получить информацию о владельце (для админов)
   * GET /api/property-owners/info/:ownerName
   */
  async getOwnerInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ownerName } = req.params;

      const owner = await db.queryOne<any>(
        `SELECT 
          id, 
          owner_name, 
          access_token, 
          initial_password, 
          current_password,
          is_active, 
          last_login_at, 
          created_at,
          can_edit_calendar,
          can_edit_pricing
        FROM property_owners 
        WHERE owner_name = ?`,
        [ownerName]
      );

      if (!owner) {
        res.status(404).json({
          success: false,
          message: 'Доступ для этого владельца не создан'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          access_url: `https://owner.novaestate.company/owner/${owner.access_token}`,
          password: owner.current_password || owner.initial_password,
          is_active: owner.is_active,
          last_login_at: owner.last_login_at,
          created_at: owner.created_at,
          can_edit_calendar: !!owner.can_edit_calendar,
          can_edit_pricing: !!owner.can_edit_pricing
        }
      });
    } catch (error) {
      logger.error('Get owner info error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения информации о владельце'
      });
    }
  }

  /**
   * Обновить разрешения владельца (для админов)
   * PUT /api/property-owners/permissions/:ownerName
   */
  async updateOwnerPermissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ownerName } = req.params;
      const { can_edit_calendar, can_edit_pricing } = req.body;

      if (can_edit_calendar === undefined && can_edit_pricing === undefined) {
        res.status(400).json({
          success: false,
          message: 'Необходимо указать хотя бы одно разрешение'
        });
        return;
      }

      // Проверяем существование владельца
      const owner = await db.queryOne<any>(
        'SELECT id, owner_name FROM property_owners WHERE owner_name = ?',
        [ownerName]
      );

      if (!owner) {
        res.status(404).json({
          success: false,
          message: 'Владелец не найден'
        });
        return;
      }

      // Обновляем разрешения
      const updates: string[] = [];
      const values: any[] = [];

      if (can_edit_calendar !== undefined) {
        updates.push('can_edit_calendar = ?');
        values.push(can_edit_calendar ? 1 : 0);
      }

      if (can_edit_pricing !== undefined) {
        updates.push('can_edit_pricing = ?');
        values.push(can_edit_pricing ? 1 : 0);
      }

      values.push(owner.id);

      await db.query(
        `UPDATE property_owners SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      logger.info(`Owner permissions updated for ${ownerName} by admin ${req.admin?.username}: calendar=${can_edit_calendar}, pricing=${can_edit_pricing}`);

      res.json({
        success: true,
        message: 'Разрешения успешно обновлены'
      });
    } catch (error) {
      logger.error('Update owner permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления разрешений'
      });
    }
  }

/**
 * Получить preview URL для объекта (для владельцев)
 * GET /api/property-owners/property/:id/preview-url
 */
async getPropertyPreviewUrl(req: AuthRequest, res: Response): Promise<void> {
  try {
    const propertyId = parseInt(req.params.id);
    const ownerName = (req as any).owner?.owner_name;

    if (!ownerName) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    // Проверяем что объект принадлежит владельцу
    const property = await db.queryOne<any>(
      `SELECT id, property_number, owner_name 
       FROM properties 
       WHERE id = ? AND owner_name = ? AND deleted_at IS NULL`,
      [propertyId, ownerName]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден или у вас нет доступа к нему'
      });
      return;
    }

    // Генерируем preview URL с токеном используя property.id
    const previewUrl = generatePreviewUrl(property.id);

    logger.info('Generated preview URL', {
      propertyId: property.id,
      property_number: property.property_number,
      ownerName,
      previewUrl
    });

    res.json({
      success: true,
      data: {
        previewUrl
      }
    });
  } catch (error) {
    logger.error('Error generating preview URL:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при генерации ссылки для просмотра'
    });
  }
}
/**
 * Получить конкретный объект владельца
 * GET /api/property-owners/property/:id
 */
async getOwnerProperty(req: AuthRequest, res: Response): Promise<void> {
  try {
    const propertyId = parseInt(req.params.id);
    const ownerName = (req as any).owner?.owner_name;

    if (!ownerName) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    // Получаем объект с проверкой владельца
    const property = await db.queryOne<any>(
      `SELECT 
        p.id,
        p.property_number,
        p.property_name,
        p.deal_type,
        p.bedrooms,
        p.bathrooms,
        p.sale_price,
        p.year_price,
        p.deposit_type,
        p.deposit_amount,
        p.electricity_rate,
        p.water_rate,
        p.sale_commission_type,
        p.rent_commission_type,
        p.region,
        p.address,
        p.indoor_area,
        p.outdoor_area
      FROM properties p
      WHERE p.id = ? AND p.owner_name = ? AND p.deleted_at IS NULL`,
      [propertyId, ownerName]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден или у вас нет доступа к нему'
      });
      return;
    }

    // Получаем фотографии
    const photosResult: any = await db.query(
      `SELECT photo_url FROM property_photos 
       WHERE property_id = ? 
       ORDER BY is_primary DESC, id ASC`,
      [property.id]
    );
    const photos = Array.isArray(photosResult) ? photosResult : 
                  Array.isArray(photosResult[0]) ? photosResult[0] : 
                  (photosResult as any).rows || [];

    // Получаем цены
    const seasonalPricing: any = await db.query(
      `SELECT 
        season_type,
        start_date_recurring,
        end_date_recurring,
        price_per_night,
        pricing_mode,
        pricing_type,
        minimum_nights
       FROM property_pricing 
       WHERE property_id = ?
       ORDER BY 
         CASE season_type
           WHEN 'low' THEN 1
           WHEN 'mid' THEN 2
           WHEN 'high' THEN 3
           WHEN 'peak' THEN 4
           WHEN 'prime' THEN 5
           WHEN 'holiday' THEN 6
           WHEN 'custom' THEN 7
         END`,
      [property.id]
    );

    const monthlyPricing: any = await db.query(
      `SELECT 
        month_number,
        price_per_month,
        pricing_mode,
        minimum_days
       FROM property_pricing_monthly 
       WHERE property_id = ?
       ORDER BY month_number`,
      [property.id]
    );

    // Получаем заблокированные даты
    const blockedDates: any = await db.query(
      `SELECT 
        blocked_date,
        reason,
        is_check_in,
        is_check_out
       FROM property_calendar 
       WHERE property_id = ? AND blocked_date >= CURDATE()
       ORDER BY blocked_date ASC`,
      [property.id]
    );

    logger.info(`Property ${propertyId} loaded for owner ${ownerName}`);

    res.json({
      success: true,
      data: {
        ...property,
        photos: photos.map((p: any) => ({ 
          url: `https://admin.novaestate.company${p.photo_url}` 
        })),
        seasonal_pricing: Array.isArray(seasonalPricing) ? seasonalPricing : 
                         Array.isArray(seasonalPricing[0]) ? seasonalPricing[0] : 
                         (seasonalPricing as any).rows || [],
        monthly_pricing: Array.isArray(monthlyPricing) ? monthlyPricing : 
                        Array.isArray(monthlyPricing[0]) ? monthlyPricing[0] : 
                        (monthlyPricing as any).rows || [],
        blocked_dates: Array.isArray(blockedDates) ? blockedDates : 
                      Array.isArray(blockedDates[0]) ? blockedDates[0] : 
                      (blockedDates as any).rows || []
      }
    });
  } catch (error) {
    logger.error('Get owner property error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки объекта'
    });
  }
}
/**
 * Обновить цены объекта (для владельцев с правами)
 * PUT /api/property-owners/property/:id/pricing
 */
async updatePropertyPricing(req: AuthRequest, res: Response): Promise<void> {
  try {
    const propertyId = parseInt(req.params.id);
    const ownerName = (req as any).owner?.owner_name;
    const canEditPricing = (req as any).owner?.can_edit_pricing;

    if (!ownerName) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    if (!canEditPricing) {
      res.status(403).json({
        success: false,
        message: 'У вас нет разрешения на редактирование цен'
      });
      return;
    }

    // Проверяем что объект принадлежит владельцу
    const property = await db.queryOne<any>(
      'SELECT id FROM properties WHERE id = ? AND owner_name = ? AND deleted_at IS NULL',
      [propertyId, ownerName]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден или у вас нет доступа к нему'
      });
      return;
    }

    const {
      sale_price,
      sale_pricing_mode,
      sale_commission_type_new,
      sale_commission_value_new,
      sale_source_price,
      sale_margin_amount,
      sale_margin_percentage,
      year_price,
      year_pricing_mode,
      year_commission_type,
      year_commission_value,
      year_source_price,
      year_margin_amount,
      year_margin_percentage,
      deposit_type,
      deposit_amount,
      electricity_rate,
      water_rate,
      seasonalPricing
    } = req.body;

    // Обновляем основные цены
    await db.query(
      `UPDATE properties SET
        sale_price = ?,
        sale_pricing_mode = ?,
        sale_commission_type_new = ?,
        sale_commission_value_new = ?,
        sale_source_price = ?,
        sale_margin_amount = ?,
        sale_margin_percentage = ?,
        year_price = ?,
        year_pricing_mode = ?,
        year_commission_type = ?,
        year_commission_value = ?,
        year_source_price = ?,
        year_margin_amount = ?,
        year_margin_percentage = ?,
        deposit_type = ?,
        deposit_amount = ?,
        electricity_rate = ?,
        water_rate = ?
      WHERE id = ?`,
      [
        sale_price,
        sale_pricing_mode,
        sale_commission_type_new,
        sale_commission_value_new,
        sale_source_price,
        sale_margin_amount,
        sale_margin_percentage,
        year_price,
        year_pricing_mode,
        year_commission_type,
        year_commission_value,
        year_source_price,
        year_margin_amount,
        year_margin_percentage,
        deposit_type,
        deposit_amount,
        electricity_rate,
        water_rate,
        propertyId
      ]
    );

    // Обновляем сезонные цены если есть
    if (seasonalPricing && Array.isArray(seasonalPricing)) {
      // Удаляем старые цены
      await db.query('DELETE FROM property_pricing WHERE property_id = ?', [propertyId]);

      // Добавляем новые
      for (const pricing of seasonalPricing) {
        await db.query(
          `INSERT INTO property_pricing 
           (property_id, season_type, start_date_recurring, end_date_recurring, 
            price_per_night, pricing_mode, pricing_type, minimum_nights,
            commission_type, commission_value, source_price, margin_amount, margin_percentage, source_price_per_night)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            propertyId,
            pricing.season_type,
            pricing.start_date_recurring,
            pricing.end_date_recurring,
            pricing.price_per_night,
            pricing.pricing_mode || 'net',
            pricing.pricing_type || 'per_night',
            pricing.minimum_nights || 1,
            pricing.commission_type,
            pricing.commission_value,
            pricing.source_price,
            pricing.margin_amount,
            pricing.margin_percentage,
            pricing.source_price_per_night
          ]
        );
      }
    }

    logger.info(`Property pricing updated for property ${propertyId} by owner ${ownerName}`);

    res.json({
      success: true,
      message: 'Цены успешно обновлены'
    });
  } catch (error) {
    logger.error('Update property pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления цен'
    });
  }
}

/**
 * Обновить месячные цены объекта (для владельцев с правами)
 * PUT /api/property-owners/property/:id/monthly-pricing
 */
async updatePropertyMonthlyPricing(req: AuthRequest, res: Response): Promise<void> {
  try {
    const propertyId = parseInt(req.params.id);
    const ownerName = (req as any).owner?.owner_name;
    const canEditPricing = (req as any).owner?.can_edit_pricing;

    if (!ownerName) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    if (!canEditPricing) {
      res.status(403).json({
        success: false,
        message: 'У вас нет разрешения на редактирование цен'
      });
      return;
    }

    // Проверяем что объект принадлежит владельцу
    const property = await db.queryOne<any>(
      'SELECT id FROM properties WHERE id = ? AND owner_name = ? AND deleted_at IS NULL',
      [propertyId, ownerName]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден или у вас нет доступа к нему'
      });
      return;
    }

    const { monthlyPricing } = req.body;

    if (!monthlyPricing || !Array.isArray(monthlyPricing)) {
      res.status(400).json({
        success: false,
        message: 'Некорректные данные месячных цен'
      });
      return;
    }

    // Удаляем старые месячные цены
    await db.query('DELETE FROM property_pricing_monthly WHERE property_id = ?', [propertyId]);

    // Добавляем новые
    for (const pricing of monthlyPricing) {
      if (pricing.price_per_month && pricing.price_per_month > 0) {
        await db.query(
          `INSERT INTO property_pricing_monthly 
           (property_id, month_number, price_per_month, pricing_mode, 
            commission_type, commission_value, source_price, margin_amount, margin_percentage, minimum_days)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            propertyId,
            pricing.month,
            pricing.price_per_month,
            pricing.pricing_mode || 'net',
            pricing.commission_type,
            pricing.commission_value,
            pricing.source_price,
            pricing.margin_amount,
            pricing.margin_percentage,
            pricing.minimum_days || 28
          ]
        );
      }
    }

    logger.info(`Monthly pricing updated for property ${propertyId} by owner ${ownerName}`);

    res.json({
      success: true,
      message: 'Месячные цены успешно обновлены'
    });
  } catch (error) {
    logger.error('Update monthly pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления месячных цен'
    });
  }
}
/**
 * Получить календарь объекта (для владельцев)
 * GET /api/property-owners/property/:id/calendar
 */
async getPropertyCalendar(req: AuthRequest, res: Response): Promise<void> {
  try {
    const propertyId = parseInt(req.params.id);
    const ownerName = (req as any).owner?.owner_name;

    if (!ownerName) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    // Проверяем что объект принадлежит владельцу
    const property = await db.queryOne<any>(
      'SELECT id FROM properties WHERE id = ? AND owner_name = ? AND deleted_at IS NULL',
      [propertyId, ownerName]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Получаем заблокированные даты
    const blockedDates = await db.query(
      `SELECT id, blocked_date, reason, is_check_in, is_check_out, source_calendar_id
       FROM property_calendar
       WHERE property_id = ?
       ORDER BY blocked_date ASC`,
      [propertyId]
    );

    // Получаем внешние календари
    const externalCalendars = await db.query(
      `SELECT id, calendar_name, ics_url, is_enabled, last_sync_at, total_events
       FROM property_external_calendars
       WHERE property_id = ?`,
      [propertyId]
    );

    res.json({
      success: true,
      data: {
        blocked_dates: Array.isArray(blockedDates) ? blockedDates : 
                      Array.isArray(blockedDates[0]) ? blockedDates[0] : [],
        external_calendars: Array.isArray(externalCalendars) ? externalCalendars :
                           Array.isArray(externalCalendars[0]) ? externalCalendars[0] : []
      }
    });
  } catch (error) {
    logger.error('Get property calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки календаря'
    });
  }
}

/**
 * Обновить календарь объекта (для владельцев с правами)
 * PUT /api/property-owners/property/:id/calendar
 */
async updatePropertyCalendar(req: AuthRequest, res: Response): Promise<void> {
  try {
    const propertyId = parseInt(req.params.id);
    const ownerName = (req as any).owner?.owner_name;
    const canEditCalendar = (req as any).owner?.can_edit_calendar;

    if (!ownerName) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    if (!canEditCalendar) {
      res.status(403).json({
        success: false,
        message: 'У вас нет разрешения на редактирование календаря'
      });
      return;
    }

    // Проверяем что объект принадлежит владельцу
    const property = await db.queryOne<any>(
      'SELECT id FROM properties WHERE id = ? AND owner_name = ? AND deleted_at IS NULL',
      [propertyId, ownerName]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    const { dates_to_add, dates_to_remove } = req.body;

    // Удаляем даты
    if (dates_to_remove && Array.isArray(dates_to_remove) && dates_to_remove.length > 0) {
      const placeholders = dates_to_remove.map(() => '?').join(',');
      await db.query(
        `DELETE FROM property_calendar 
         WHERE property_id = ? AND blocked_date IN (${placeholders})`,
        [propertyId, ...dates_to_remove]
      );
    }

    // Добавляем новые даты
    if (dates_to_add && Array.isArray(dates_to_add) && dates_to_add.length > 0) {
      for (const dateInfo of dates_to_add) {
        await db.query(
          `INSERT INTO property_calendar 
           (property_id, blocked_date, reason, is_check_in, is_check_out)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           reason = VALUES(reason),
           is_check_in = VALUES(is_check_in),
           is_check_out = VALUES(is_check_out)`,
          [
            propertyId,
            dateInfo.date,
            dateInfo.reason || 'Заблокировано владельцем',
            dateInfo.is_check_in ? 1 : 0,
            dateInfo.is_check_out ? 1 : 0
          ]
        );
      }
    }

    logger.info(`Calendar updated for property ${propertyId} by owner ${ownerName}`);

    res.json({
      success: true,
      message: 'Календарь успешно обновлён'
    });
  } catch (error) {
    logger.error('Update property calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления календаря'
    });
  }
}
}

export default new PropertyOwnersController();