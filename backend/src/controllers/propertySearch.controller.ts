// backend/src/controllers/propertySearch.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import aiSearchService from '../services/aiSearch.service';
import googleMapsService from '../services/googleMaps.service';
import { getImageUrl } from '../utils/imageUrl';
import priceCalculationService from '../services/priceCalculation.service';

/**
 * Конвертация snake_case в camelCase
 * Используется для нормализации особенностей от AI
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Конвертация массива особенностей из snake_case в camelCase
 */
function normalizeFeatures(features: string[] | undefined): string[] {
  if (!features || !Array.isArray(features)) {
    return [];
  }
  
  return features.map(feature => {
    // Если уже в camelCase - возвращаем как есть
    if (!feature.includes('_')) {
      return feature;
    }
    // Конвертируем snake_case в camelCase
    return snakeToCamel(feature);
  });
}

interface SearchFilters {
  flexible_dates?: {
    duration: number;
    search_window_start: string;
    search_window_end: string;
  };
  deal_type?: string;
  property_type?: string;
  bedrooms?: number;
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms?: number;
  bathrooms_min?: number;
  bathrooms_max?: number;
  
  // ✅ НОВОЕ: Типы владения
  building_ownership?: 'freehold' | 'leasehold' | 'company';
  land_ownership?: 'freehold' | 'leasehold' | 'company';
  ownership_type?: 'freehold' | 'leasehold' | 'company';
  
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
    tolerance?: number;
    search_below_max?: boolean;
  };
  dates?: {
    check_in?: string;
    check_out?: string;
    tolerance_days?: number;
  } | null;
  regions?: string[];
  
  // ✅ НОВОЕ: Разделение на обязательные и желаемые особенности
  features?: string[];
  must_have_features?: string[];
  
  furniture?: string;
  parking?: boolean;
  pets?: boolean;
  complex_name?: string;
  floor?: {
    min?: number;
    max?: number;
  };
  floors?: {
    min?: number;
    max?: number;
  };
  distance_to_beach?: {
    max?: number;
  };
  owner_name?: string;
  map_search?: {
    lat: number;
    lng: number;
    radius_km: number;
  };
}

class PropertySearchController {
  /**
   * Поиск недвижимости через AI с поддержкой диалогов
   * POST /api/property-search/ai
   */
  async searchWithAI(req: AuthRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { query, conversationId } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Необходимо указать текст запроса'
        });
        return;
      }

      logger.info(`AI search request from user ${req.admin?.id}: "${query}"`);

      // Загружаем историю диалога если есть
      let conversationHistory: any[] = [];
      let convId = conversationId;

      if (conversationId) {
        conversationHistory = await this.loadConversationHistory(conversationId, req.admin!.id);
      } else {
        // Создаем новый диалог
        convId = await this.createConversation(req.admin!.id, 'property_search', query);
      }

      // Сохраняем сообщение пользователя
      await this.saveMessage(convId, 'user', query);

      // Анализируем запрос через AI
      const interpretation = await aiSearchService.analyzeSearchQuery(query, conversationHistory);

      logger.info('AI interpretation:', interpretation);

      // Конвертируем интерпретацию AI в фильтры
      const filters = this.convertAIToFilters(interpretation);

      // Выполняем поиск
      const searchResult = await this.executeSearch(filters, req.admin!.id);
      
      // Рассчитываем цены для найденных объектов
      let propertiesWithPrices = await this.calculatePricesForProperties(
        searchResult.properties,
        filters.dates
      );
      
      // ✅ ФИЛЬТРУЕМ ПО БЮДЖЕТУ ПОСЛЕ РАСЧЕТА ЦЕН (если есть даты и бюджет)
      if (filters.budget?.max && filters.dates?.check_in && filters.dates?.check_out) {
        let budgetMax = filters.budget.max;
        const tolerance = filters.budget.tolerance || 0;
      
        // Применяем погрешность только если указана
        if (tolerance > 0) {
          budgetMax = budgetMax * (1 + tolerance / 100);
          logger.info(`Budget tolerance: ${tolerance}% → new max: ${budgetMax}`);
        }
        
        // Конвертируем в THB если нужно
        if (filters.budget.currency && filters.budget.currency !== 'THB') {
          budgetMax = aiSearchService.convertToTHB(budgetMax, filters.budget.currency);
        }
        
        logger.info(`=== POST-CALCULATION BUDGET FILTER: max ${budgetMax} THB ===`);
        
        const beforeCount = propertiesWithPrices.length;
        
        propertiesWithPrices = propertiesWithPrices.filter(property => {
          // Для продажи - проверяем sale_price
          if (property.deal_type === 'sale') {
            return property.sale_price && property.sale_price <= budgetMax;
          }
          
          // Для аренды - проверяем calculated_price.total_price
          if (property.calculated_price?.total_price) {
            const totalPrice = property.calculated_price.total_price;
            const withinBudget = totalPrice <= budgetMax;
          
            if (!withinBudget) {
              logger.info(`❌ Property ${property.id} excluded: ${totalPrice} THB > ${budgetMax} THB`);
            } else {
              logger.info(`✅ Property ${property.id} included: ${totalPrice} THB <= ${budgetMax} THB`);
            }
            
            return withinBudget;
          }
          
          // Если цена не рассчитана - исключаем
          logger.warn(`⚠️ Property ${property.id} has no calculated price`);
          return false;
        });
        
        logger.info(`Budget filter: ${beforeCount} → ${propertiesWithPrices.length} properties`);
      }
      
      const executionTime = Date.now() - startTime;

      // Формируем ответ AI
      const aiResponse = this.generateAIResponse(interpretation, propertiesWithPrices.length);
      
      // Сохраняем ответ AI
      await this.saveMessage(convId, 'assistant', aiResponse, {
        interpretation,
        propertiesCount: propertiesWithPrices.length
      });

      // Сохраняем лог поиска
        await this.saveSearchLog({
          user_id: req.admin!.id,
          search_type: 'ai',
          search_params: filters,
          ai_query: query,
          ai_interpretation: interpretation,
          ai_raw_response: JSON.stringify(interpretation, null, 2),
          conversation_id: convId, // ✅ ДОБАВИТЬ
          results_count: propertiesWithPrices.length,
          property_ids: propertiesWithPrices.map(p => p.id),
          execution_time_ms: executionTime
          
        });

      res.json({
        success: true,
        data: {
          conversationId: convId,
          interpretation: {
            confidence: interpretation.confidence,
            reasoning: interpretation.reasoning,
            extracted_params: interpretation
          },
          aiResponse,
          properties: propertiesWithPrices,
          total: propertiesWithPrices.length,
          execution_time_ms: executionTime,
          requested_features: filters.features || [],
          must_have_features: filters.must_have_features || []
          
        }
      });
    } catch (error: any) {
      logger.error('AI search error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Ошибка поиска через AI'
      });
    }
  }

  
  /**
   * Режим клиент-агент (общение с клиентом)
   * POST /api/property-search/chat
   */
  async chatWithClient(req: AuthRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { message, conversationId } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Необходимо указать текст сообщения'
        });
        return;
      }

      logger.info(`Client chat from user ${req.admin?.id}: "${message}"`);

      // Загружаем или создаем диалог
      let conversationHistory: any[] = [];
      let convId = conversationId;

      if (conversationId) {
        conversationHistory = await this.loadConversationHistory(conversationId, req.admin!.id);
      } else {
        convId = await this.createConversation(req.admin!.id, 'client_agent', message);
      }

      // Сохраняем сообщение клиента
      await this.saveMessage(convId, 'user', message);

      // Получаем ответ AI
      const aiResult = await aiSearchService.chatWithClient(message, conversationHistory);

      // Сохраняем ответ AI
      await this.saveMessage(convId, 'assistant', aiResult.response);

      const executionTime = Date.now() - startTime;

      let properties = [];
      
    // Если AI предложил показать варианты и есть параметры поиска
    if (aiResult.shouldShowProperties && aiResult.searchParams) {
      const filters = this.convertAIToFilters(aiResult.searchParams);
      const searchResult = await this.executeSearch(filters, req.admin!.id);
      properties = await this.calculatePricesForProperties(
        searchResult.properties,
        filters.dates
      );

      // ✅ ФИЛЬТРУЕМ ПО БЮДЖЕТУ ПОСЛЕ РАСЧЕТА ЦЕН
      if (filters.budget?.max && filters.dates?.check_in && filters.dates?.check_out) {
        let budgetMax = filters.budget.max;
        const tolerance = filters.budget.tolerance || 0;

        if (tolerance > 0) {
          budgetMax = budgetMax * (1 + tolerance / 100);
        }

        if (filters.budget.currency && filters.budget.currency !== 'THB') {
          budgetMax = aiSearchService.convertToTHB(budgetMax, filters.budget.currency);
        }

        properties = properties.filter(property => {
          if (property.deal_type === 'sale') {
            return property.sale_price && property.sale_price <= budgetMax;
          }

          if (property.calculated_price?.total_price) {
            return property.calculated_price.total_price <= budgetMax;
          }

          return false;
        });
      }
    }

      res.json({
        success: true,
        data: {
          conversationId: convId,
          response: aiResult.response,
          shouldShowProperties: aiResult.shouldShowProperties,
          properties,
          total: properties.length,
          execution_time_ms: executionTime,
          requested_features: aiResult.searchParams?.features || [],
          must_have_features: aiResult.searchParams?.must_have_features || []
        }
      });
    } catch (error: any) {
      logger.error('Client chat error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Ошибка общения с AI'
      });
    }
  }

  /**
   * Мануальный поиск недвижимости
   * POST /api/property-search/manual
   */
  async searchManual(req: AuthRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const filters: SearchFilters = req.body;

      logger.info(`Manual search request from user ${req.admin?.id}:`, filters);

      // Выполняем поиск
      const searchResult = await this.executeSearch(filters, req.admin!.id);
          
      // Рассчитываем цены
      let propertiesWithPrices = await this.calculatePricesForProperties(
        searchResult.properties,
        filters.dates
      );
      
      // ✅ ФИЛЬТРУЕМ ПО БЮДЖЕТУ ПОСЛЕ РАСЧЕТА ЦЕН
      if (filters.budget?.max && filters.dates?.check_in && filters.dates?.check_out) {
        let budgetMax = filters.budget.max;
        const tolerance = filters.budget.tolerance || 0;
      
        if (tolerance > 0) {
          budgetMax = budgetMax * (1 + tolerance / 100);
        }
        
        if (filters.budget.currency && filters.budget.currency !== 'THB') {
          budgetMax = aiSearchService.convertToTHB(budgetMax, filters.budget.currency);
        }
        
        logger.info(`=== POST-CALCULATION BUDGET FILTER: max ${budgetMax} THB ===`);
        
        propertiesWithPrices = propertiesWithPrices.filter(property => {
          if (property.deal_type === 'sale') {
            return property.sale_price && property.sale_price <= budgetMax;
          }
          
          if (property.calculated_price?.total_price) {
            return property.calculated_price.total_price <= budgetMax;
          }
          
          return false;
        });
      }
      
      const executionTime = Date.now() - startTime;

      // Сохраняем лог
      await this.saveSearchLog({
        user_id: req.admin!.id,
        search_type: 'manual',
        search_params: filters,
        results_count: propertiesWithPrices.length,
        property_ids: propertiesWithPrices.map(p => p.id),
        execution_time_ms: executionTime
      });

      res.json({
        success: true,
        data: {
          properties: propertiesWithPrices,
          total: propertiesWithPrices.length,
          execution_time_ms: executionTime,
          requested_features: filters.features || [],
          must_have_features: filters.must_have_features || []
        }
      });
    } catch (error: any) {
      logger.error('Manual search error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Ошибка поиска'
      });
    }
  }

  /**
   * Получить список диалогов пользователя
   * GET /api/property-search/conversations
   */
  async getConversations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, mode } = req.query;
      const userId = req.admin!.id;

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10)));
      const offset = (pageNum - 1) * limitNum;

      let modeFilter = '';
      const params: any[] = [userId];

      if (mode && (mode === 'property_search' || mode === 'client_agent')) {
        modeFilter = 'AND mode = ?';
        params.push(mode);
      }

      const total = await db.queryOne<any>(
        `SELECT COUNT(*) as total 
         FROM ai_conversations 
         WHERE user_id = ? AND status = 'active' ${modeFilter}`,
        params
      );

      const conversations = await db.query(
        `SELECT 
          c.id,
          c.mode,
          c.title,
          c.status,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM ai_conversation_messages WHERE conversation_id = c.id) as messages_count,
          (SELECT content FROM ai_conversation_messages 
           WHERE conversation_id = c.id AND role = 'user' 
           ORDER BY created_at ASC LIMIT 1) as first_message
        FROM ai_conversations c
        WHERE c.user_id = ? AND c.status = 'active' ${modeFilter}
        ORDER BY c.updated_at DESC
        LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      res.json({
        success: true,
        data: {
          conversations,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: total?.total || 0,
            totalPages: Math.ceil((total?.total || 0) / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения списка диалогов'
      });
    }
  }

  /**
   * Получить историю конкретного диалога
   * GET /api/property-search/conversations/:id
   */
  async getConversationById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.admin!.id;

      const conversation = await db.queryOne<any>(
        `SELECT * FROM ai_conversations 
         WHERE id = ? AND user_id = ?`,
        [id, userId]
      );

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Диалог не найден'
        });
        return;
      }

      const messages = await db.query(
        `SELECT role, content, metadata, created_at
         FROM ai_conversation_messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`,
        [id]
      );

      res.json({
        success: true,
        data: {
          conversation,
          messages
        }
      });
    } catch (error) {
      logger.error('Get conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения диалога'
      });
    }
  }

  /**
   * Удалить (архивировать) диалог
   * DELETE /api/property-search/conversations/:id
   */
  async deleteConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.admin!.id;

      const conversation = await db.queryOne<any>(
        'SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Диалог не найден'
        });
        return;
      }

      await db.query(
        'UPDATE ai_conversations SET status = ? WHERE id = ?',
        ['archived', id]
      );

      res.json({
        success: true,
        message: 'Диалог архивирован'
      });
    } catch (error) {
      logger.error('Delete conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления диалога'
      });
    }
  }

  /**
   * Получить историю поисков пользователя
   * GET /api/property-search/history
   */
  async getSearchHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const userId = req.admin!.id;

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10)));
      const offset = (pageNum - 1) * limitNum;

      const total = await db.queryOne<any>(
        'SELECT COUNT(*) as total FROM property_search_logs WHERE user_id = ?',
        [userId]
      );

      const history = await db.query(
        `SELECT 
          id,
          search_type,
          search_params,
          ai_query,
          ai_interpretation,
          results_count,
          execution_time_ms,
          created_at
        FROM property_search_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, limitNum, offset]
      );

      res.json({
        success: true,
        data: {
          history,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: total?.total || 0,
            totalPages: Math.ceil((total?.total || 0) / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error('Get search history error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения истории поисков'
      });
    }
  }

  /**
   * Рассчитать расстояние до пляжа для объекта
   * POST /api/property-search/calculate-beach-distance
   */
  async calculateBeachDistance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        res.status(400).json({
          success: false,
          message: 'Необходимо указать координаты'
        });
        return;
      }

      const result = await googleMapsService.calculateDistanceToNearestBeach({
        lat: latitude,
        lng: longitude
      });

      const category = googleMapsService.categorizeDistance(result.distance);

      res.json({
        success: true,
        data: {
          distance: result.distance,
          distanceFormatted: this.formatDistance(result.distance),
          category,
          nearestBeach: result.beachName
        }
      });
    } catch (error: any) {
      logger.error('Calculate beach distance error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Ошибка расчета расстояния'
      });
    }
  }

/**
 * Найти доступные окна для duration + search_window
 */
private async findAvailableWindows(
  propertyId: number,
  duration: number,
  searchWindowStart: string,
  searchWindowEnd: string
): Promise<Array<{ check_in: string; check_out: string; price?: number }>> {
  const windows: Array<{ check_in: string; check_out: string; price?: number }> = [];
  
  logger.info(`🔍 Finding ${duration}-night windows for property ${propertyId} in ${searchWindowStart} to ${searchWindowEnd}`);
  
  const start = new Date(searchWindowStart);
  const end = new Date(searchWindowEnd);
  
  let currentDate = new Date(start);
  let checkedDays = 0;
  const maxChecks = 100; // Защита от бесконечного цикла
  
  while (currentDate <= end && checkedDays < maxChecks) {
    const checkIn = currentDate.toISOString().split('T')[0];
    const checkOutDate = new Date(currentDate.getTime() + duration * 24 * 60 * 60 * 1000);
    const checkOut = checkOutDate.toISOString().split('T')[0];
    
    // Проверяем не выходит ли за пределы окна
    if (checkOutDate > end) {
      logger.info(`Window ${checkIn} to ${checkOut} exceeds search window end`);
      break;
    }
    
    // Проверяем доступность через CalendarService
    try {
    const availabilityResult = await this.checkPropertyAvailability(
      propertyId,
      checkIn,
      checkOut,
      0 // tolerance_days = 0 для строгой проверки
    );
    
    const isAvailable = availabilityResult.available;
      
      if (isAvailable) {
        // Рассчитываем цену для этого окна
        let price: number | undefined;
        try {
          const calculatedPrice = await priceCalculationService.calculatePrice(
            propertyId,
            checkIn,
            checkOut
          );
          price = calculatedPrice?.total_price || undefined;
        } catch (e) {
          logger.warn(`Could not calculate price for window ${checkIn}-${checkOut}`);
        }
        
        windows.push({ 
          check_in: checkIn, 
          check_out: checkOut,
          price 
        });
        
        logger.info(`✓ Available window found: ${checkIn} to ${checkOut}${price ? ` (${price} THB)` : ''}`);
      } else {
        logger.debug(`✗ Window ${checkIn} to ${checkOut} is blocked`);
      }
    } catch (error) {
      logger.error(`Error checking availability for ${checkIn}-${checkOut}:`, error);
    }
    
    // Сдвигаем на 1 день
    currentDate.setDate(currentDate.getDate() + 1);
    checkedDays++;
  }
  
  logger.info(`Found ${windows.length} available windows for property ${propertyId}`);
  
  return windows;
}

/**
 * Выполнить поиск с фильтрами
 */
private async executeSearch(filters: SearchFilters, userId: number): Promise<{ properties: any[] }> {
  const whereConditions: string[] = [
  'p.deleted_at IS NULL', 
  'p.status IN ("published", "draft")'
    ];
  const queryParams: any[] = [];

  logger.info('=== STARTING PROPERTY SEARCH ===');
  logger.info('Filters:', JSON.stringify(filters, null, 2));

  // Deal type
  if (filters.deal_type) {
    if (filters.deal_type === 'both') {
      // Не фильтруем
      logger.info('Deal type: both (no filter)');
    } else {
      whereConditions.push('(p.deal_type = ? OR p.deal_type = "both")');
      queryParams.push(filters.deal_type);
      logger.info(`Deal type filter: ${filters.deal_type}`);
    }
  }

  // Property type
  if (filters.property_type) {
    whereConditions.push('p.property_type = ?');
    queryParams.push(filters.property_type);
    logger.info(`Property type filter: ${filters.property_type}`);
  }

    // Bedrooms - НОВАЯ ЛОГИКА
    if (filters.bedrooms !== undefined && filters.bedrooms !== null) {
      // Точное количество спален
      whereConditions.push('p.bedrooms = ?');
      queryParams.push(filters.bedrooms);
      logger.info(`Bedrooms filter: EXACTLY ${filters.bedrooms}`);
    } else {
      // Диапазон спален
      if (filters.bedrooms_min !== undefined && filters.bedrooms_min !== null) {
        whereConditions.push('p.bedrooms >= ?');
        queryParams.push(filters.bedrooms_min);
        logger.info(`Bedrooms filter: >= ${filters.bedrooms_min}`);
      }
      if (filters.bedrooms_max !== undefined && filters.bedrooms_max !== null) {
        whereConditions.push('p.bedrooms <= ?');
        queryParams.push(filters.bedrooms_max);
        logger.info(`Bedrooms filter: <= ${filters.bedrooms_max}`);
      }
    }
    
    // Bathrooms - НОВАЯ ЛОГИКА
    if (filters.bathrooms !== undefined && filters.bathrooms !== null) {
      // Точное количество ванных
      whereConditions.push('p.bathrooms = ?');
      queryParams.push(filters.bathrooms);
      logger.info(`Bathrooms filter: EXACTLY ${filters.bathrooms}`);
    } else {
      // Диапазон ванных
      if (filters.bathrooms_min !== undefined && filters.bathrooms_min !== null) {
        whereConditions.push('p.bathrooms >= ?');
        queryParams.push(filters.bathrooms_min);
        logger.info(`Bathrooms filter: >= ${filters.bathrooms_min}`);
      }
      if (filters.bathrooms_max !== undefined && filters.bathrooms_max !== null) {
        whereConditions.push('p.bathrooms <= ?');
        queryParams.push(filters.bathrooms_max);
        logger.info(`Bathrooms filter: <= ${filters.bathrooms_max}`);
      }
    }

  // Regions
  if (filters.regions && filters.regions.length > 0) {
    const regionPlaceholders = filters.regions.map(() => '?').join(',');
    whereConditions.push(`p.region IN (${regionPlaceholders})`);
    queryParams.push(...filters.regions);
    logger.info(`Regions filter: ${filters.regions.join(', ')}`);
  }

  // ✅ ТИПЫ ВЛАДЕНИЯ (только для продажи)
  if (filters.building_ownership) {
    whereConditions.push('p.building_ownership = ?');
    queryParams.push(filters.building_ownership);
    logger.info(`Building ownership filter: ${filters.building_ownership}`);
  }

  if (filters.land_ownership) {
    whereConditions.push('p.land_ownership = ?');
    queryParams.push(filters.land_ownership);
    logger.info(`Land ownership filter: ${filters.land_ownership}`);
  }

  if (filters.ownership_type) {
    whereConditions.push('p.ownership_type = ?');
    queryParams.push(filters.ownership_type);
    logger.info(`Ownership type filter: ${filters.ownership_type}`);
  }

  // Furniture
  if (filters.furniture) {
    whereConditions.push('p.furniture_status = ?');
    queryParams.push(filters.furniture);
    logger.info(`Furniture filter: ${filters.furniture}`);
  }

  // Parking
  if (filters.parking === true) {
    whereConditions.push('p.parking_spaces > 0');
    logger.info('Parking filter: required');
  }

  // Pets
  if (filters.pets === true) {
    whereConditions.push('p.pets_allowed IN ("yes", "negotiable")');
    logger.info('Pets filter: allowed');
  }

  // Complex name
  if (filters.complex_name) {
    whereConditions.push('p.complex_name LIKE ?');
    queryParams.push(`%${filters.complex_name}%`);
    logger.info(`Complex name filter: ${filters.complex_name}`);
  }

  // Floor
  if (filters.floor) {
    if (filters.floor.min !== undefined) {
      whereConditions.push('p.floor >= ?');
      queryParams.push(filters.floor.min);
      logger.info(`Floor min: ${filters.floor.min}`);
    }
    if (filters.floor.max !== undefined) {
      whereConditions.push('p.floor <= ?');
      queryParams.push(filters.floor.max);
      logger.info(`Floor max: ${filters.floor.max}`);
    }
  }

  // Floors (этажность здания)
  if (filters.floors) {
    if (filters.floors.min !== undefined) {
      whereConditions.push('p.floors >= ?');
      queryParams.push(filters.floors.min);
      logger.info(`Building floors min: ${filters.floors.min}`);
    }
    if (filters.floors.max !== undefined) {
      whereConditions.push('p.floors <= ?');
      queryParams.push(filters.floors.max);
      logger.info(`Building floors max: ${filters.floors.max}`);
    }
  }

  // Distance to beach
  if (filters.distance_to_beach?.max) {
    whereConditions.push('(p.distance_to_beach IS NOT NULL AND p.distance_to_beach <= ?)');
    queryParams.push(filters.distance_to_beach.max);
    logger.info(`Distance to beach: <= ${filters.distance_to_beach.max}m`);
  }

  // Owner name (только если есть права)
  if (filters.owner_name) {
    const canViewOwner = await this.checkOwnerViewPermission(userId);
    if (canViewOwner) {
      whereConditions.push('p.owner_name LIKE ?');
      queryParams.push(`%${filters.owner_name}%`);
      logger.info(`Owner filter: ${filters.owner_name}`);
    }
  }

  // Map search (поиск по радиусу от точки)
  if (filters.map_search) {
    const { lat, lng, radius_km } = filters.map_search;
    whereConditions.push(`
      (6371 * acos(
        cos(radians(?)) * cos(radians(p.latitude)) * 
        cos(radians(p.longitude) - radians(?)) + 
        sin(radians(?)) * sin(radians(p.latitude))
      )) <= ?
    `);
    queryParams.push(lat, lng, lat, radius_km);
    logger.info(`Map search: radius ${radius_km}km from (${lat}, ${lng})`);
  }

  // ✅ КРИТИЧЕСКИ ВАЖНО: BUDGET FILTER
  if (filters.budget && filters.budget.max) {
    let budgetMax = filters.budget.max;
    const tolerance = filters.budget.tolerance || 0;

    // Применяем погрешность
    if (tolerance > 0) {
      budgetMax = budgetMax * (1 + tolerance / 100);
      logger.info(`Budget tolerance: ${tolerance}% → new max: ${budgetMax}`);
    }

    // Конвертируем в THB если нужно
    if (filters.budget.currency && filters.budget.currency !== 'THB') {
      const originalMax = budgetMax;
      budgetMax = aiSearchService.convertToTHB(budgetMax, filters.budget.currency);
      logger.info(`Budget conversion: ${originalMax} ${filters.budget.currency} → ${budgetMax} THB`);
    }

    logger.info(`=== BUDGET FILTER: max ${budgetMax} THB ===`);

    // Для продажи - проверяем sale_price
    if (filters.deal_type === 'sale') {
      whereConditions.push('(p.sale_price IS NOT NULL AND p.sale_price <= ?)');
      queryParams.push(budgetMax);
      logger.info(`Sale price filter: <= ${budgetMax} THB`);
    } 

    // ✅ ДЛЯ АРЕНДЫ С ДАТАМИ - НЕ ФИЛЬТРУЕМ В SQL (будем фильтровать после расчета)
    else if (filters.deal_type === 'rent' || !filters.deal_type) {
      if (!filters.dates?.check_in || !filters.dates?.check_out) {
        // Только если НЕТ конкретных дат - фильтруем по месячным ценам
        logger.info(`Monthly/yearly price filter: <= ${budgetMax} THB/month`);

        whereConditions.push(`(
          (p.year_price IS NOT NULL AND p.year_price / 12 <= ?) OR
          EXISTS (
            SELECT 1 FROM property_pricing_monthly ppm
            WHERE ppm.property_id = p.id
            AND ppm.price_per_month <= ?
          )
        )`);
        queryParams.push(budgetMax, budgetMax);
      } else {
        // ✅ ЕСЛИ ЕСТЬ ДАТЫ - пропускаем SQL фильтр, будем фильтровать после расчета
        logger.info(`⚠️ Budget filter for dates will be applied AFTER price calculation`);
      }
    }
  }  // ✅ ДОБАВЛЕНА ЗАКРЫВАЮЩАЯ СКОБКА для if (filters.budget && filters.budget.max)

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : '';

  let query = `
    SELECT DISTINCT
      p.id,
      p.property_number,
      p.deal_type,
      p.property_type,
      p.region,
      p.address,
      p.latitude,
      p.longitude,
      p.complex_name,
      p.bedrooms,
      p.bathrooms,
      p.indoor_area,
      p.outdoor_area,
      p.distance_to_beach,
      p.sale_price,
      p.year_price,
      p.minimum_nights,
      p.furniture_status,
      p.parking_spaces,
      p.pets_allowed,
      p.floor,
      p.floors,
      p.created_at,
      p.created_by,
      pt.property_name,
      pt.description,
      (SELECT photo_url FROM property_photos 
       WHERE property_id = p.id 
       ORDER BY is_primary DESC, sort_order ASC 
       LIMIT 1) as cover_photo,
      (SELECT COUNT(*) FROM property_photos WHERE property_id = p.id) as photos_count
    FROM properties p
    LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'ru'
    ${whereClause}
  `;

  logger.info('Base query constructed, executing...');
  let properties = await db.query<any>(query, queryParams);
  logger.info(`Base query returned ${properties.length} properties`);

  // ✅ КРИТИЧЕСКИ ВАЖНО: FEATURES FILTER
  // Сначала фильтруем по ОБЯЗАТЕЛЬНЫМ особенностям (must_have)
  if (filters.must_have_features && filters.must_have_features.length > 0) {
    logger.info(`=== FILTERING BY MUST-HAVE FEATURES: ${filters.must_have_features.join(', ')} ===`);
    
    const propertiesWithMustHaveFeatures: any[] = [];
    
    for (const property of properties) {
      let hasAllMustHaveFeatures = true;
      
      // Проверяем наличие КАЖДОЙ обязательной особенности
      for (const requiredFeature of filters.must_have_features) {
        const hasFeature = await db.queryOne<any>(
          `SELECT 1 FROM property_features 
           WHERE property_id = ? AND feature_value = ?
           LIMIT 1`,
          [property.id, requiredFeature]
        );
        
        if (!hasFeature) {
          hasAllMustHaveFeatures = false;
          logger.info(`Property ${property.id} missing MUST-HAVE feature: ${requiredFeature}`);
          break;
        }
      }
      
      if (hasAllMustHaveFeatures) {
        propertiesWithMustHaveFeatures.push(property);
      }
    }
    
    properties = propertiesWithMustHaveFeatures;
    logger.info(`After MUST-HAVE features filter: ${properties.length} properties`);
  }

  // Затем проверяем ЖЕЛАЕМЫЕ особенности (для сортировки, не для исключения)
  if (filters.features && filters.features.length > 0) {
    logger.info(`=== CHECKING DESIRED FEATURES: ${filters.features.join(', ')} ===`);
    
    // Для каждого объекта считаем количество совпадений и недостающие особенности
    for (const property of properties) {
      let matchedFeaturesCount = 0;
      const missingFeatures: string[] = [];
      
      for (const desiredFeature of filters.features) {
        const hasFeature = await db.queryOne<any>(
          `SELECT 1 FROM property_features 
           WHERE property_id = ? AND feature_value = ?
           LIMIT 1`,
          [property.id, desiredFeature]
        );
        
        if (hasFeature) {
          matchedFeaturesCount++;
        } else {
          missingFeatures.push(desiredFeature);
        }
      }
      
      // Добавляем метаданные к объекту
      property.features_match_score = matchedFeaturesCount;
      property.features_match_total = filters.features.length;
      property.missing_features = missingFeatures;
      
      logger.info(`Property ${property.id}: ${matchedFeaturesCount}/${filters.features.length} features matched. Missing: ${missingFeatures.join(', ') || 'none'}`);
    }
    
    // ✅ СОРТИРОВКА ПО КОЛИЧЕСТВУ СОВПАДАЮЩИХ ОСОБЕННОСТЕЙ
    properties.sort((a, b) => {
      const scoreA = a.features_match_score || 0;
      const scoreB = b.features_match_score || 0;
      return scoreB - scoreA; // От большего к меньшему
    });
    
    logger.info(`Properties sorted by features match score`);
  }

  // ✅ КРИТИЧЕСКИ ВАЖНО: DATE AVAILABILITY FILTER
  // Фильтруем по доступности на даты
  let filteredProperties = properties;
  
  if (filters.dates && filters.dates.check_in && filters.dates.check_out) {
    logger.info(`=== FILTERING BY DATE AVAILABILITY: ${filters.dates.check_in} to ${filters.dates.check_out} ===`);
    
    filteredProperties = await this.filterByDateAvailability(
      properties,
      filters.dates.check_in,
      filters.dates.check_out,
      filters.dates.tolerance_days || 0
    );
    
    logger.info(`After date filter: ${filteredProperties.length} properties`);
  }

  // ✅ ОБРАБОТКА FLEXIBLE DATES (duration + search_window)
  if (filters.flexible_dates) {
    logger.info('=== PROCESSING FLEXIBLE DATES ===');
    logger.info(`Looking for ${filters.flexible_dates.duration}-night windows in period ${filters.flexible_dates.search_window_start} to ${filters.flexible_dates.search_window_end}`);
    
    const { duration, search_window_start, search_window_end } = filters.flexible_dates;
    
    // Для каждого объекта найдем доступные окна
    const propertiesWithWindows: any[] = [];
    
    for (const property of filteredProperties) {
      const availableWindows = await this.findAvailableWindows(
        property.id,
        duration,
        search_window_start,
        search_window_end
      );
      
      if (availableWindows.length > 0) {
        // Берем первое доступное окно с минимальной ценой
        const bestWindow = availableWindows.reduce((best, current) => {
          if (!best.price) return current;
          if (!current.price) return best;
          return current.price < best.price ? current : best;
        }, availableWindows[0]);
        
        propertiesWithWindows.push({
          ...property,
          available_windows: availableWindows,
          // Устанавливаем даты из лучшего окна для расчета цены
          check_in: bestWindow.check_in,
          check_out: bestWindow.check_out,
          total_available_windows: availableWindows.length
        });
        
        logger.info(`✓ Property ${property.id} has ${availableWindows.length} available windows, best: ${bestWindow.check_in} to ${bestWindow.check_out}`);
      } else {
        logger.info(`✗ Property ${property.id} has NO available ${duration}-night windows in the specified period`);
      }
    }
    
    filteredProperties = propertiesWithWindows;
    
    logger.info(`=== FLEXIBLE DATES COMPLETE: ${filteredProperties.length} properties with available windows ===`);
  }

  // Добавляем URL изображений
  const propertiesWithUrls = filteredProperties.map((property: any) => ({
    ...property,
    cover_photo: getImageUrl(property.cover_photo, true)
  }));

  logger.info(`=== SEARCH COMPLETED: ${propertiesWithUrls.length} properties found ===`);

  return { properties: propertiesWithUrls };
}

/**
 * Фильтрация по доступности на даты
 */
private async filterByDateAvailability(
  properties: any[],
  checkIn: string,
  checkOut: string,
  toleranceDays: number
): Promise<any[]> {
  const available: any[] = [];

  logger.info(`Checking availability for ${properties.length} properties`);
  logger.info(`Date range: ${checkIn} to ${checkOut} (tolerance: ${toleranceDays} days)`);

  for (const property of properties) {
    const availabilityResult = await this.checkPropertyAvailability(
      property.id,
      checkIn,
      checkOut,
      toleranceDays
    );

    if (availabilityResult.available) {
      available.push({
        ...property,
        has_calendar: availabilityResult.hasCalendar,
        calendar_warning: !availabilityResult.hasCalendar
      });
      
      if (!availabilityResult.hasCalendar) {
        logger.warn(`⚠️ Property ${property.id} added WITHOUT calendar (needs manual check)`);
      } else {
        logger.info(`✓ Property ${property.id} is available`);
      }
    } else {
      logger.info(`✗ Property ${property.id} is NOT available (dates blocked)`);
    }
  }

  return available;
}

/**
 * Проверить доступность объекта на даты
 * Возвращает { available, hasCalendar }
 */
private async checkPropertyAvailability(
  propertyId: number,
  checkIn: string,
  checkOut: string,
  toleranceDays: number
): Promise<{ available: boolean; hasCalendar: boolean }> {
  try {
    let startDate = new Date(checkIn);
    let endDate = new Date(checkOut);

    // Применяем толерантность (гибкость дат)
    if (toleranceDays > 0) {
      startDate.setDate(startDate.getDate() - toleranceDays);
      endDate.setDate(endDate.getDate() + toleranceDays);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // ✅ ПРОВЕРЯЕМ НАЛИЧИЕ КАЛЕНДАРЯ ВООБЩЕ
    const hasAnyCalendar = await db.queryOne<any>(
      `SELECT COUNT(*) as count
       FROM property_calendar
       WHERE property_id = ?
       LIMIT 1`,
      [propertyId]
    );

    const hasCalendar = (hasAnyCalendar?.count || 0) > 0;

    // ✅ ЕСЛИ КАЛЕНДАРЯ НЕТ - ОБЪЕКТ ДОСТУПЕН, НО С ПРЕДУПРЕЖДЕНИЕМ
    if (!hasCalendar) {
      logger.warn(`⚠️ Property ${propertyId} has NO calendar - showing as available with warning`);
      return { available: true, hasCalendar: false };
    }

    // Проверяем есть ли ХОТЯ БЫ ОДНА заблокированная дата в диапазоне
    const blockedDates = await db.query<any>(
      `SELECT COUNT(*) as count
       FROM property_calendar
       WHERE property_id = ?
       AND blocked_date >= ?
       AND blocked_date <= ?`,
      [propertyId, startStr, endStr]
    );

    const count = Array.isArray(blockedDates) && blockedDates[0]?.count 
      ? blockedDates[0].count 
      : 0;

    // Если есть хотя бы одна заблокированная дата - объект недоступен
    const isAvailable = count === 0;

    if (!isAvailable) {
      logger.info(`Property ${propertyId} has ${count} blocked dates in range`);
    }

    return { available: isAvailable, hasCalendar: true };
  } catch (error) {
    logger.error(`Error checking availability for property ${propertyId}:`, error);
    return { available: false, hasCalendar: true };
  }
}

/**
 * Рассчитать цены для объектов
 */
private async calculatePricesForProperties(
  properties: any[],
  dates?: { check_in?: string; check_out?: string } | null
): Promise<any[]> {
  const result: any[] = [];

  logger.info(`Calculating prices for ${properties.length} properties`);

  for (const property of properties) {
    let calculatedPrice: any = null;

    // Для объектов на продажу - цену не рассчитываем
    if (property.deal_type === 'sale') {
      result.push({
        ...property,
        calculated_price: null
      });
      continue;
    }

    // ✅ ПРОВЕРЯЕМ НАЛИЧИЕ ДАТ В САМОМ ОБЪЕКТЕ (для flexible_dates)
    const checkIn = property.check_in || dates?.check_in;
    const checkOut = property.check_out || dates?.check_out;

    // Если указаны даты - рассчитываем цену на конкретный период
    if (checkIn && checkOut) {
      calculatedPrice = await priceCalculationService.calculatePrice(
        property.id,
        checkIn,
        checkOut
      );

      logger.info(`Property ${property.id} price for ${checkIn} to ${checkOut}: ${calculatedPrice?.total_price || 'N/A'} THB`);
    } else {
      // Если даты не указаны - показываем примерную месячную цену
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      calculatedPrice = await priceCalculationService.calculatePrice(
        property.id,
        today.toISOString().split('T')[0],
        nextMonth.toISOString().split('T')[0]
      );
    }

    result.push({
      ...property,
      // Форматируем числа без .00
      bedrooms: property.bedrooms ? Math.round(property.bedrooms) : null,
      bathrooms: property.bathrooms ? Math.round(property.bathrooms) : null,
      sale_price: property.sale_price ? Math.round(property.sale_price) : null,
      year_price: property.year_price ? Math.round(property.year_price) : null,
      calculated_price: calculatedPrice,
      // Сохраняем информацию о доступных окнах если есть
      available_windows: property.available_windows || [],
      total_available_windows: property.total_available_windows || 0
    });
  }

  logger.info(`Price calculation complete for ${result.length} properties`);

  return result;
}

/**
 * Найти доступные периоды для объекта
 * POST /api/property-search/available-periods
 */
async findAvailablePeriods(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { property_id, nights, month, year } = req.body;

    if (!property_id || !nights) {
      res.status(400).json({
        success: false,
        message: 'Необходимо указать property_id и nights'
      });
      return;
    }

    logger.info(`Finding available periods: property=${property_id}, nights=${nights}, month=${month || 'any'}`);

    const periods = await priceCalculationService.findAvailablePeriods(
      property_id,
      nights,
      month,
      year || new Date().getFullYear()
    );

    res.json({
      success: true,
      data: {
        property_id,
        nights,
        periods,
        total_found: periods.length
      }
    });
  } catch (error: any) {
    logger.error('Find available periods error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка поиска доступных периодов'
    });
  }
}

/**
 * ВРЕМЕННЫЙ МЕТОД ДЛЯ ОТЛАДКИ - проверить данные о ценах в БД
 * GET /api/property-search/debug-pricing/:propertyId
 */
async debugPricing(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;

    logger.info(`=== DEBUG PRICING FOR PROPERTY ${propertyId} ===`);

    // Загружаем все данные
    const property = await db.queryOne<any>(
      'SELECT id, property_number, property_type, deal_type, year_price FROM properties WHERE id = ?',
      [propertyId]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    const seasonalPrices = await db.query<any>(
      `SELECT * FROM property_pricing WHERE property_id = ? ORDER BY start_date_recurring`,
      [propertyId]
    );

    const monthlyPrices = await db.query<any>(
      `SELECT * FROM property_pricing_monthly WHERE property_id = ? ORDER BY month_number`,
      [propertyId]
    );

    const calendar = await db.query<any>(
      `SELECT blocked_date, reason, source_calendar_id 
       FROM property_calendar 
       WHERE property_id = ? 
       AND blocked_date >= CURDATE() 
       ORDER BY blocked_date 
       LIMIT 20`,
      [propertyId]
    );

    logger.info(`Property ${propertyId} data:`, {
      year_price: property.year_price,
      seasonal_count: seasonalPrices.length,
      monthly_count: monthlyPrices.length,
      blocked_dates: calendar.length
    });

    res.json({
      success: true,
      data: {
        property: {
          id: property.id,
          property_number: property.property_number,
          property_type: property.property_type,
          deal_type: property.deal_type,
          year_price: property.year_price
        },
        pricing: {
          year_price: property.year_price,
          seasonal_prices: seasonalPrices,
          monthly_prices: monthlyPrices,
          summary: {
            has_seasonal: seasonalPrices.length > 0,
            has_monthly: monthlyPrices.length > 0,
            has_yearly: !!property.year_price,
            total_pricing_records: seasonalPrices.length + monthlyPrices.length
          }
        },
        calendar: {
          upcoming_blocked_dates: calendar,
          total_blocked: calendar.length
        }
      }
    });
  } catch (error: any) {
    logger.error('Debug pricing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения данных'
    });
  }
}

/**
 * Конвертация AI интерпретации в фильтры
 */
/**
 * Конвертация AI интерпретации в фильтры
 */
private convertAIToFilters(interpretation: any): SearchFilters {
  const filters: SearchFilters = {};

  logger.info('=== CONVERTING AI INTERPRETATION TO FILTERS ===');
  logger.info('Raw interpretation:', JSON.stringify(interpretation, null, 2));

  if (interpretation.deal_type) {
    filters.deal_type = interpretation.deal_type;
    logger.info(`Deal type: ${interpretation.deal_type}`);
  }

  if (interpretation.property_type) {
    filters.property_type = interpretation.property_type;
    logger.info(`Property type: ${interpretation.property_type}`);
  }

  // ✅ ТИПЫ ВЛАДЕНИЯ (для продажи)
  if (interpretation.building_ownership) {
    filters.building_ownership = interpretation.building_ownership;
    logger.info(`Building ownership: ${interpretation.building_ownership}`);
  }

  if (interpretation.land_ownership) {
    filters.land_ownership = interpretation.land_ownership;
    logger.info(`Land ownership: ${interpretation.land_ownership}`);
  }

  if (interpretation.ownership_type) {
    filters.ownership_type = interpretation.ownership_type;
    logger.info(`Ownership type: ${interpretation.ownership_type}`);
  }

  // ✅ СПАЛЬНИ - поддержка точного количества и диапазона
  if (interpretation.bedrooms !== undefined && interpretation.bedrooms !== null) {
    filters.bedrooms = interpretation.bedrooms;
    logger.info(`Bedrooms: EXACTLY ${interpretation.bedrooms}`);
  } else {
    if (interpretation.bedrooms_min !== undefined && interpretation.bedrooms_min !== null) {
      filters.bedrooms_min = interpretation.bedrooms_min;
      logger.info(`Bedrooms min: ${interpretation.bedrooms_min}`);
    }
    if (interpretation.bedrooms_max !== undefined && interpretation.bedrooms_max !== null) {
      filters.bedrooms_max = interpretation.bedrooms_max;
      logger.info(`Bedrooms max: ${interpretation.bedrooms_max}`);
    }
  }

  // ✅ ВАННЫЕ - поддержка точного количества и диапазона
  if (interpretation.bathrooms !== undefined && interpretation.bathrooms !== null) {
    filters.bathrooms = interpretation.bathrooms;
    logger.info(`Bathrooms: EXACTLY ${interpretation.bathrooms}`);
  } else {
    if (interpretation.bathrooms_min !== undefined && interpretation.bathrooms_min !== null) {
      filters.bathrooms_min = interpretation.bathrooms_min;
      logger.info(`Bathrooms min: ${interpretation.bathrooms_min}`);
    }
    if (interpretation.bathrooms_max !== undefined && interpretation.bathrooms_max !== null) {
      filters.bathrooms_max = interpretation.bathrooms_max;
      logger.info(`Bathrooms max: ${interpretation.bathrooms_max}`);
    }
  }

  // ✅ БЮДЖЕТ
  if (interpretation.budget) {
    const { amount, currency, tolerance = 0 } = interpretation.budget;
    
    filters.budget = {
      min: 0,
      max: amount,
      currency: currency || 'THB',
      tolerance,
      search_below_max: true
    };
    
    logger.info(`Budget: max ${amount} ${currency || 'THB'} (tolerance: ${tolerance}%)`);
  }

  // ✅ ДАТЫ (только для аренды)
  logger.info('=== DATE PROCESSING ===');
  logger.info(`Deal type: ${interpretation.deal_type}`);
  logger.info(`Has dates: ${!!interpretation.dates}`);
  logger.info(`Has duration: ${interpretation.duration}`);
  logger.info(`Has search_window: ${!!interpretation.search_window}`);

  // Для ПРОДАЖИ даты не нужны
  if (interpretation.deal_type === 'sale') {
    logger.info('🏛️ SALE MODE: dates ignored');
    filters.dates = null;
  } else if (interpretation.duration && interpretation.search_window) {
    // ✅ СЛУЧАЙ 1: Ищем короткий период внутри окна (только для аренды)
    logger.info('🎯 FLEXIBLE DATES MODE: duration + search_window');
    
    filters.flexible_dates = {
      duration: interpretation.duration,
      search_window_start: interpretation.search_window.start,
      search_window_end: interpretation.search_window.end
    };
    
    filters.dates = null;
    
    logger.info(`✓ Flexible search: ${interpretation.duration} nights within ${interpretation.search_window.start} to ${interpretation.search_window.end}`);
    
  } else if (interpretation.dates) {
    // ✅ СЛУЧАЙ 2: Конкретные даты указаны (только для аренды)
    logger.info('📅 FIXED DATES MODE: specific check-in/check-out');
    
    filters.dates = {
      check_in: interpretation.dates.check_in,
      check_out: interpretation.dates.check_out,
      tolerance_days: interpretation.dates.tolerance_days || 0
    };
    
    logger.info(`✓ Fixed dates: ${interpretation.dates.check_in} to ${interpretation.dates.check_out}`);
    
  } else if (interpretation.duration && interpretation.deal_type !== 'sale') {
    // ✅ СЛУЧАЙ 3: Только продолжительность без окна (только для аренды)
    logger.info('⏱️ DURATION ONLY MODE: from today');
    
    const today = new Date();
    const checkout = new Date(today);
    checkout.setDate(checkout.getDate() + interpretation.duration);
    
    filters.dates = {
      check_in: today.toISOString().split('T')[0],
      check_out: checkout.toISOString().split('T')[0],
      tolerance_days: 7
    };
    
    logger.info(`✓ Duration from today: ${interpretation.duration} nights with 7 days tolerance`);
  }

  if (interpretation.regions && Array.isArray(interpretation.regions) && interpretation.regions.length > 0) {
    filters.regions = interpretation.regions;
    logger.info(`Regions: ${interpretation.regions.join(', ')}`);
  }

// ✅ ОБЯЗАТЕЛЬНЫЕ ОСОБЕННОСТИ (must_have_features) - нормализуем в camelCase
if (interpretation.must_have_features && Array.isArray(interpretation.must_have_features) && interpretation.must_have_features.length > 0) {
  filters.must_have_features = normalizeFeatures(interpretation.must_have_features);
  logger.info(`🚨 MUST HAVE features (normalized): ${filters.must_have_features.join(', ')}`);
  if (interpretation.must_have_features.some((f: string) => f.includes('_'))) {
    logger.warn(`⚠️ AI returned snake_case features, converted to camelCase`);
  }
}

// ✅ ЖЕЛАЕМЫЕ ОСОБЕННОСТИ (features) - нормализуем в camelCase
if (interpretation.features && Array.isArray(interpretation.features) && interpretation.features.length > 0) {
  filters.features = normalizeFeatures(interpretation.features);
  logger.info(`✨ DESIRED features (normalized): ${filters.features.join(', ')}`);
  if (interpretation.features.some((f: string) => f.includes('_'))) {
    logger.warn(`⚠️ AI returned snake_case features, converted to camelCase`);
  }
}

  if (interpretation.furniture) {
    filters.furniture = interpretation.furniture;
    logger.info(`Furniture: ${interpretation.furniture}`);
  }

  if (interpretation.parking !== undefined) {
    filters.parking = interpretation.parking;
    logger.info(`Parking: ${interpretation.parking}`);
  }

  if (interpretation.pets !== undefined) {
    filters.pets = interpretation.pets;
    logger.info(`Pets: ${interpretation.pets}`);
  }

  if (interpretation.complex_name) {
    filters.complex_name = interpretation.complex_name;
    logger.info(`Complex name: ${interpretation.complex_name}`);
  }

  if (interpretation.floor) {
    filters.floor = interpretation.floor;
    logger.info(`Floor: ${JSON.stringify(interpretation.floor)}`);
  }

  if (interpretation.floors) {
    filters.floors = interpretation.floors;
    logger.info(`Floors: ${JSON.stringify(interpretation.floors)}`);
  }

  if (interpretation.distance_to_beach) {
    filters.distance_to_beach = interpretation.distance_to_beach;
    logger.info(`Distance to beach: ${JSON.stringify(interpretation.distance_to_beach)}`);
  }

  if (interpretation.owner_name) {
    filters.owner_name = interpretation.owner_name;
    logger.info(`Owner name: ${interpretation.owner_name}`);
  }

  logger.info('=== FILTERS CONVERSION COMPLETE ===');
  logger.info('Final filters:', JSON.stringify(filters, null, 2));

  return filters;
}

  /**
   * Создать новый диалог
   */
  private async createConversation(
    userId: number,
    mode: 'property_search' | 'client_agent',
    firstMessage: string
  ): Promise<number> {
    const title = firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...' 
      : firstMessage;

    const result = await db.query(
      'INSERT INTO ai_conversations (user_id, mode, title) VALUES (?, ?, ?)',
      [userId, mode, title]
    );

    return (result as any).insertId;
  }

  /**
   * Загрузить историю диалога
   */
  private async loadConversationHistory(
    conversationId: number,
    userId: number
  ): Promise<any[]> {
    const conversation = await db.queryOne<any>(
      'SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    );

    if (!conversation) {
      throw new Error('Диалог не найден');
    }

    const messages = await db.query<any>(
      `SELECT role, content 
       FROM ai_conversation_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC 
       LIMIT 20`,
      [conversationId]
    );

    return messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Сохранить сообщение в диалоге
   */
  private async saveMessage(
    conversationId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): Promise<void> {
    await db.query(
      'INSERT INTO ai_conversation_messages (conversation_id, role, content, metadata) VALUES (?, ?, ?, ?)',
      [conversationId, role, content, metadata ? JSON.stringify(metadata) : null]
    );

    // Обновляем время последнего обновления диалога
    await db.query(
      'UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );
  }

/**
 * Сгенерировать ответ AI для пользователя
 */
private generateAIResponse(interpretation: any, propertiesCount: number): string {
  const confidence = interpretation.confidence;
  
  // Низкая уверенность AI
  if (confidence < 0.6) {
    return `Я проанализировал ваш запрос, но некоторые параметры требуют уточнения. ${interpretation.reasoning}\n\n` +
           `Найдено объектов: ${propertiesCount}. Попробуйте уточнить ваш запрос для более точных результатов.`;
  }

  // Ничего не найдено
  if (propertiesCount === 0) {
    let suggestions = '';
    
    // Даём полезные советы на основе фильтров
    if (interpretation.budget && interpretation.budget.amount < 30000) {
      suggestions += '\n\n💡 Ваш бюджет может быть слишком низким. Минимальные цены на Пхукете начинаются от 30,000 THB в месяц.';
    }
    
    if (interpretation.features && interpretation.features.length > 5) {
      suggestions += '\n\n💡 Возможно, у вас слишком много требований к особенностям. Попробуйте убрать некоторые фильтры.';
    }
    
    if (interpretation.distance_to_beach && interpretation.distance_to_beach.max < 500) {
      suggestions += '\n\n💡 Попробуйте увеличить допустимое расстояние до пляжа.';
    }

    if (interpretation.regions && interpretation.regions.length === 1) {
      suggestions += '\n\n💡 Попробуйте добавить больше районов для поиска.';
    }

    return `К сожалению, по вашим критериям не найдено подходящих объектов.${suggestions}\n\n` +
           `Рекомендую попробовать:\n` +
           `• Увеличить бюджет\n` +
           `• Убрать некоторые фильтры\n` +
           `• Выбрать другие районы\n` +
           `• Изменить даты заезда`;
  }

  // Найден 1 объект
  if (propertiesCount === 1) {
    return `Отлично! Я нашел 1 объект, который идеально соответствует вашим критериям. 🎯`;
  }

  // Найдено 2-5 объектов
  if (propertiesCount <= 5) {
    return `Отлично! Я нашел ${propertiesCount} объекта, которые соответствуют вашим критериям. Все варианты доступны на выбранные даты. ✅`;
  }

  // Найдено 6-10 объектов
  if (propertiesCount <= 10) {
    return `Я нашел ${propertiesCount} подходящих объектов. У вас хороший выбор! 👍`;
  }

  // Найдено много объектов
  return `Я нашел ${propertiesCount} объектов по вашему запросу. Это довольно много вариантов! 🏠\n\n` +
         `Рекомендую уточнить параметры для более точного подбора:\n` +
         `• Укажите конкретный район\n` +
         `• Добавьте особенности (бассейн, вид на море и т.д.)\n` +
         `• Уточните бюджет`;
}

  /**
   * Проверить права на просмотр владельца
   */
  private async checkOwnerViewPermission(userId: number): Promise<boolean> {
    try {
      const user = await db.queryOne<any>(
        `SELECT is_super_admin FROM admin_users WHERE id = ?`,
        [userId]
      );

      if (user?.is_super_admin) {
        return true;
      }

      const hasPermission = await db.queryOne<any>(
        `SELECT 1 
         FROM user_roles ur
         JOIN role_permissions rp ON ur.role_id = rp.role_id
         JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.user_id = ? 
         AND p.permission_name = 'properties.viewOwner'`,
        [userId]
      );

      return !!hasPermission;
    } catch (error) {
      logger.error('Error checking owner view permission:', error);
      return false;
    }
  }

/**
 * Сохранить лог поиска
 */
private async saveSearchLog(data: {
  user_id: number;
  search_type: string;
  search_params: any;
  ai_query?: string;
  ai_interpretation?: any;
  ai_raw_response?: string;
  conversation_id?: number; // ✅ ДОБАВИТЬ
  results_count: number;
  property_ids: number[];
  execution_time_ms: number;
}): Promise<void> {
  try {
    await db.query(
      `INSERT INTO property_search_logs (
        user_id, search_type, search_params, ai_query, ai_interpretation,
        ai_raw_response, conversation_id, results_count, property_ids, execution_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.search_type,
        JSON.stringify(data.search_params),
        data.ai_query || null,
        data.ai_interpretation ? JSON.stringify(data.ai_interpretation) : null,
        data.ai_raw_response || null,
        data.conversation_id || null, // ✅ ДОБАВИТЬ
        data.results_count,
        JSON.stringify(data.property_ids),
        data.execution_time_ms
      ]
    );

    logger.info(`Search log saved for user ${data.user_id}`);
  } catch (error) {
    logger.error('Save search log error:', error);
  }
}

/**
 * Получить AI interpretation для последнего поиска
 * GET /api/property-search/last-ai-interpretation
 */
async getLastAIInterpretation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.admin!.id;

    const lastSearch = await db.queryOne<any>(
      `SELECT 
        id,
        ai_query,
        ai_interpretation,
        ai_raw_response,
        search_params,
        results_count,
        created_at
       FROM property_search_logs
       WHERE user_id = ? AND search_type = 'ai'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (!lastSearch) {
      res.status(404).json({
        success: false,
        message: 'Не найдено AI поисков'
      });
      return;
    }

    // Парсим JSON если нужно
    let interpretation = lastSearch.ai_interpretation;
    if (typeof interpretation === 'string') {
      try {
        interpretation = JSON.parse(interpretation);
      } catch (e) {
        // Already parsed or invalid
      }
    }

    let searchParams = lastSearch.search_params;
    if (typeof searchParams === 'string') {
      try {
        searchParams = JSON.parse(searchParams);
      } catch (e) {
        // Already parsed or invalid
      }
    }

    res.json({
      success: true,
      data: {
        id: lastSearch.id,
        query: lastSearch.ai_query,
        raw_response: lastSearch.ai_raw_response,
        interpretation: interpretation,
        converted_filters: searchParams,
        results_count: lastSearch.results_count,
        created_at: lastSearch.created_at
      }
    });
  } catch (error: any) {
    logger.error('Get last AI interpretation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения AI interpretation'
    });
  }
}

  /**
   * Форматировать расстояние
   */
  private formatDistance(distanceInMeters: number): string {
    if (distanceInMeters < 1000) {
      return `${Math.round(distanceInMeters)} м`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)} км`;
  }

  /**
 * Получить конкретный лог поиска по ID
 * GET /api/property-search/history/:id
 */
async getSearchHistoryById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const log = await db.queryOne<any>(
      `SELECT * FROM property_search_logs 
       WHERE id = ? AND user_id = ?`,
      [id, req.admin?.id]
    );

    if (!log) {
      res.status(404).json({
        success: false,
        message: 'Запись не найдена'
      });
      return;
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    logger.error('Get search history by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения записи истории'
    });
  }
}

/**
 * Получить результаты конкретного поиска (с объектами)
 * GET /api/property-search/history/:id/results
 */
async getSearchResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const log = await db.queryOne<any>(
      `SELECT * FROM property_search_logs 
       WHERE id = ? AND user_id = ?`,
      [id, req.admin?.id]
    );

    if (!log) {
      res.status(404).json({
        success: false,
        message: 'Запись не найдена'
      });
      return;
    }

    // Парсим property_ids
    let propertyIds: number[] = [];
    try {
      propertyIds = typeof log.property_ids === 'string' 
        ? JSON.parse(log.property_ids) 
        : log.property_ids;
    } catch (e) {
      logger.error('Error parsing property_ids:', e);
    }

    // Загружаем объекты
    let properties: any[] = [];
    if (propertyIds && propertyIds.length > 0) {
      const placeholders = propertyIds.map(() => '?').join(',');
      properties = await db.query<any>(
        `SELECT 
          p.id,
          p.property_number,
          p.deal_type,
          p.property_type,
          p.region,
          p.address,
          p.latitude,
          p.longitude,
          p.complex_name,
          p.bedrooms,
          p.bathrooms,
          p.indoor_area,
          p.outdoor_area,
          p.distance_to_beach,
          p.sale_price,
          p.year_price,
          p.minimum_nights,
          p.furniture_status,
          p.parking_spaces,
          p.pets_allowed,
          p.floor,
          p.floors,
          p.created_at,
          p.created_by,
          pt.property_name,
          pt.description,
          (SELECT photo_url FROM property_photos 
           WHERE property_id = p.id 
           ORDER BY is_primary DESC, sort_order ASC 
           LIMIT 1) as cover_photo,
          (SELECT COUNT(*) FROM property_photos WHERE property_id = p.id) as photos_count
        FROM properties p
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'ru'
        WHERE p.id IN (${placeholders})
        AND p.deleted_at IS NULL`,
        propertyIds
      );

      // Добавляем URL изображений
      properties = properties.map((property: any) => ({
        ...property,
        cover_photo: getImageUrl(property.cover_photo, true),
        // Форматируем числа
        bedrooms: property.bedrooms ? Math.round(property.bedrooms) : null,
        bathrooms: property.bathrooms ? Math.round(property.bathrooms) : null,
        sale_price: property.sale_price ? Math.round(property.sale_price) : null,
        year_price: property.year_price ? Math.round(property.year_price) : null
      }));

      // Рассчитываем цены если есть даты
      const searchParams = typeof log.search_params === 'string' 
        ? JSON.parse(log.search_params) 
        : log.search_params;

      if (searchParams?.dates?.check_in && searchParams?.dates?.check_out) {
        properties = await this.calculatePricesForProperties(
          properties,
          searchParams.dates
        );
      }
    }

    // Парсим параметры поиска
    let searchParams = log.search_params;
    if (typeof searchParams === 'string') {
      try {
        searchParams = JSON.parse(searchParams);
      } catch (e) {
        searchParams = {};
      }
    }

    res.json({
      success: true,
      data: {
        log: {
          id: log.id,
          search_type: log.search_type,
          ai_query: log.ai_query,
          search_params: searchParams,
          results_count: log.results_count,
          execution_time_ms: log.execution_time_ms,
          created_at: log.created_at,
          conversation_id: log.conversation_id
        },
        properties
      }
    });
  } catch (error) {
    logger.error('Get search results error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения результатов поиска'
    });
  }
}

/**
 * Удалить лог из истории
 * DELETE /api/property-search/history/:id
 */
async deleteSearchHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Проверяем существование и принадлежность пользователю
    const log = await db.queryOne<any>(
      'SELECT id FROM property_search_logs WHERE id = ? AND user_id = ?',
      [id, req.admin?.id]
    );

    if (!log) {
      res.status(404).json({
        success: false,
        message: 'Запись не найдена'
      });
      return;
    }

    await db.query(
      'DELETE FROM property_search_logs WHERE id = ?',
      [id]
    );

    logger.info(`Search history log deleted: ${id} by user ${req.admin?.username}`);

    res.json({
      success: true,
      message: 'Запись удалена из истории'
    });
  } catch (error) {
    logger.error('Delete search history error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления записи из истории'
    });
  }
}

}

export default new PropertySearchController();