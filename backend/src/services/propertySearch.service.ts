// backend/src/services/propertySearch.service.ts
import db from '../config/database';
import logger from '../utils/logger';
import { RowDataPacket } from 'mysql2';

interface SearchParams {
  deal_type?: string;
  property_type?: string;
  bedrooms?: number;
  bedrooms_flexible?: boolean;
  bathrooms?: number;
  budget?: {
    amount: number;
    currency: string;
    tolerance: number;
    per_period: 'night' | 'month' | 'total';
  };
  dates?: {
    check_in?: string;
    check_out?: string;
    duration_nights?: number;
    duration_months?: number;
  };
  regions?: string[];
  features?: string[];
  location_requirements?: {
    beach_distance?: number;
    quiet_area?: boolean;
    infrastructure_nearby?: boolean;
  };
  property_preferences?: {
    complex_name?: string;
    must_have_features?: string[];
  };
  guest_info?: {
    adults?: number;
    children?: number;
    pets?: boolean;
  };
  urgency?: string;
}

interface PropertyMatch {
  property: any;
  score: number;
  matchReasons: string[];
  price: number;
  availability: boolean;
  totalCost?: number;
}

class PropertySearchService {
  /**
   * Умный поиск недвижимости с ранжированием
   */
  async intelligentSearch(params: SearchParams): Promise<PropertyMatch[]> {
    logger.info('🔍 Starting intelligent property search', params);

    try {
      // 1. Базовый SQL запрос
      const baseQuery = this.buildBaseQuery(params);
      
      // 2. Получаем кандидаты
      const [properties] = await db.query<RowDataPacket[]>(baseQuery.sql, baseQuery.values);
      
      logger.info(`Found ${properties.length} candidate properties`);

      if (properties.length === 0) {
        return [];
      }

      // 3. Для каждого объекта проверяем доступность и считаем цену
      const matches: PropertyMatch[] = [];

      for (const property of properties) {
        const analysis = await this.analyzeProperty(property, params);
        
        if (analysis.suitable) {
          matches.push({
            property: property,
            score: analysis.score,
            matchReasons: analysis.reasons,
            price: analysis.price,
            availability: analysis.available,
            totalCost: analysis.totalCost
          });
        }
      }

      // 4. Сортируем по релевантности
      matches.sort((a, b) => b.score - a.score);

      logger.info(`Returning ${matches.length} matched properties`);
      
      // Возвращаем топ-20
      return matches.slice(0, 20);

    } catch (error) {
      logger.error('Property search error:', error);
      throw error;
    }
  }

  /**
   * Строим базовый SQL запрос
   */
  private buildBaseQuery(params: SearchParams): { sql: string; values: any[] } {
    let sql = `
      SELECT DISTINCT
        p.*,
        GROUP_CONCAT(DISTINCT pf.feature_type) as features_list
      FROM properties p
      LEFT JOIN property_features pf ON p.id = pf.property_id
      WHERE p.deleted_at IS NULL
        AND p.status = 'active'
    `;

    const values: any[] = [];

    // Deal type
    if (params.deal_type && params.deal_type !== 'both') {
      sql += ` AND (p.deal_type = ? OR p.deal_type = 'both')`;
      values.push(params.deal_type);
    }

    // Property type
    if (params.property_type) {
      sql += ` AND p.property_type = ?`;
      values.push(params.property_type);
    }

    // Bedrooms (с гибкостью ±1)
    if (params.bedrooms !== undefined) {
      if (params.bedrooms_flexible) {
        sql += ` AND p.bedrooms BETWEEN ? AND ?`;
        values.push(Math.max(0, params.bedrooms - 1), params.bedrooms + 1);
      } else {
        sql += ` AND p.bedrooms = ?`;
        values.push(params.bedrooms);
      }
    }

    // Bathrooms
    if (params.bathrooms) {
      sql += ` AND p.bathrooms >= ?`;
      values.push(params.bathrooms);
    }

    // Regions
    if (params.regions && params.regions.length > 0) {
      const regionPlaceholders = params.regions.map(() => '?').join(',');
      sql += ` AND p.region IN (${regionPlaceholders})`;
      values.push(...params.regions);
    }

    // Complex name
    if (params.property_preferences?.complex_name) {
      sql += ` AND p.complex_name LIKE ?`;
      values.push(`%${params.property_preferences.complex_name}%`);
    }

    // Pets
    if (params.guest_info?.pets) {
      sql += ` AND p.pets_allowed = 1`;
    }

    sql += ` GROUP BY p.id`;
    sql += ` ORDER BY p.created_at DESC`;
    sql += ` LIMIT 100`; // Берем топ-100 кандидатов для дальнейшего анализа

    return { sql, values };
  }

  /**
   * Анализируем каждый объект: цена, доступность, соответствие
   */
  private async analyzeProperty(property: any, params: SearchParams): Promise<{
    suitable: boolean;
    score: number;
    reasons: string[];
    price: number;
    available: boolean;
    totalCost?: number;
  }> {
    const reasons: string[] = [];
    let score = 100; // Базовый балл

    // 1. Проверяем доступность (занятость)
    const available = await this.checkAvailability(property.id, params.dates);
    if (!available && params.urgency !== 'normal') {
      // Если срочно и занято - пропускаем
      return { suitable: false, score: 0, reasons: ['Занято на указанные даты'], price: 0, available: false };
    }

    if (available) {
      score += 50;
      reasons.push('Свободен на выбранные даты');
    } else {
      score -= 30;
      reasons.push('Частично занят');
    }

    // 2. Считаем цену
    const priceAnalysis = await this.calculatePrice(property, params);
    
    if (!priceAnalysis.suitable) {
      return { suitable: false, score: 0, reasons: ['Не подходит по бюджету'], price: 0, available };
    }

    score += priceAnalysis.scoreBonus;
    reasons.push(...priceAnalysis.reasons);

    // 3. Проверяем особенности
    const featuresScore = await this.checkFeatures(property.id, params);
    score += featuresScore.score;
    reasons.push(...featuresScore.reasons);

    // 4. Проверяем расположение
    const locationScore = this.checkLocation(property, params);
    score += locationScore.score;
    reasons.push(...locationScore.reasons);

    // 5. Бонусы
    if (property.bedrooms === params.bedrooms) {
      score += 20;
      reasons.push('Точное совпадение по спальням');
    }

    if (params.property_preferences?.complex_name && 
        property.complex_name?.toLowerCase().includes(params.property_preferences.complex_name.toLowerCase())) {
      score += 100;
      reasons.push('Точное совпадение комплекса');
    }

    // Срочность
    if (params.urgency === 'immediate' || params.urgency === 'today') {
      if (available) {
        score += 50;
        reasons.push('Доступен для срочного заселения');
      }
    }

    return {
      suitable: score > 50,
      score,
      reasons,
      price: priceAnalysis.price,
      available,
      totalCost: priceAnalysis.totalCost
    };
  }

  /**
   * Проверка доступности по календарю
   */
  private async checkAvailability(propertyId: number, dates?: any): Promise<boolean> {
    if (!dates?.check_in) {
      return true; // Если даты не указаны - считаем доступным
    }

    const checkIn = new Date(dates.check_in);
    let checkOut: Date;

    if (dates.check_out) {
      checkOut = new Date(dates.check_out);
    } else if (dates.duration_nights) {
      checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + dates.duration_nights);
    } else if (dates.duration_months) {
      checkOut = new Date(checkIn);
      checkOut.setMonth(checkOut.getMonth() + dates.duration_months);
    } else {
      // По умолчанию проверяем месяц
      checkOut = new Date(checkIn);
      checkOut.setMonth(checkOut.getMonth() + 1);
    }

    const [blocked] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM property_calendar 
       WHERE property_id = ? 
         AND blocked_date >= ? 
         AND blocked_date < ?`,
      [propertyId, checkIn.toISOString().split('T')[0], checkOut.toISOString().split('T')[0]]
    );

    return blocked[0].count === 0;
  }

  /**
   * Расчет цены и проверка соответствия бюджету
   */
  private async calculatePrice(property: any, params: SearchParams): Promise<{
    suitable: boolean;
    price: number;
    totalCost?: number;
    scoreBonus: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    
    if (!params.budget) {
      return { suitable: true, price: 0, scoreBonus: 0, reasons: ['Бюджет не указан'] };
    }

    let price = 0;
    let totalCost = 0;

    // Определяем период аренды
    const duration = this.calculateDuration(params.dates);

    if (params.budget.per_period === 'month' || duration.months > 0) {
      // Месячная аренда
      price = await this.getMonthlyPrice(property.id, params.dates?.check_in);
      
      if (!price && property.year_price) {
        price = property.year_price / 12;
      }

      totalCost = price * (duration.months || 1);
      reasons.push(`Цена за месяц: ${Math.round(price).toLocaleString()} THB`);
      
    } else {
      // Посуточная аренда
      price = await this.getNightlyPrice(property.id, params.dates?.check_in);
      totalCost = price * (duration.nights || 30);
      reasons.push(`Цена за ночь: ${Math.round(price).toLocaleString()} THB`);
    }

    if (price === 0) {
      return { suitable: false, price: 0, scoreBonus: 0, reasons: ['Цена не указана'] };
    }

    // Проверяем бюджет с учетом tolerance
    const budgetAmount = params.budget.amount;
    const tolerance = params.budget.tolerance || 0;
    const maxBudget = budgetAmount * (1 + tolerance / 100);
    const minBudget = budgetAmount * (1 - tolerance / 100);

    let comparePrice = price;
    if (params.budget.per_period === 'total') {
      comparePrice = totalCost;
    }

    if (comparePrice > maxBudget) {
      reasons.push(`Превышает бюджет (${Math.round(comparePrice).toLocaleString()} > ${Math.round(maxBudget).toLocaleString()} THB)`);
      return { suitable: false, price, totalCost, scoreBonus: 0, reasons };
    }

    // Считаем бонус за цену
    let scoreBonus = 0;
    if (comparePrice <= minBudget) {
      scoreBonus = 30;
      reasons.push('Отличная цена - ниже бюджета');
    } else if (comparePrice <= budgetAmount) {
      scoreBonus = 20;
      reasons.push('Хорошая цена - в рамках бюджета');
    } else {
      scoreBonus = 10;
      reasons.push('Цена немного выше бюджета, но в пределах допустимого');
    }

    return { suitable: true, price, totalCost, scoreBonus, reasons };
  }

  /**
   * Получить месячную цену
   */
  private async getMonthlyPrice(propertyId: number, checkInDate?: string): Promise<number> {
    if (!checkInDate) {
      // Если даты нет, берем среднюю цену
      const [result] = await db.query<RowDataPacket[]>(
        `SELECT AVG(price_per_month) as avg_price 
         FROM property_pricing_monthly 
         WHERE property_id = ?`,
        [propertyId]
      );
      return result[0]?.avg_price || 0;
    }

    const month = new Date(checkInDate).getMonth() + 1;
    
    const [result] = await db.query<RowDataPacket[]>(
      `SELECT price_per_month 
       FROM property_pricing_monthly 
       WHERE property_id = ? AND month_number = ?`,
      [propertyId, month]
    );

    return result[0]?.price_per_month || 0;
  }

  /**
   * Получить цену за ночь
   */
  private async getNightlyPrice(propertyId: number, checkInDate?: string): Promise<number> {
    if (!checkInDate) {
      // Если даты нет, берем среднюю цену
      const [result] = await db.query<RowDataPacket[]>(
        `SELECT AVG(price_per_night) as avg_price 
         FROM property_pricing 
         WHERE property_id = ?`,
        [propertyId]
      );
      return result[0]?.avg_price || 0;
    }

    const date = new Date(checkInDate);
    const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // Ищем сезонную цену
    const [result] = await db.query<RowDataPacket[]>(
      `SELECT price_per_night 
       FROM property_pricing 
       WHERE property_id = ? 
         AND start_date_recurring <= ? 
         AND end_date_recurring >= ?
       ORDER BY season_type DESC
       LIMIT 1`,
      [propertyId, monthDay, monthDay]
    );

    return result[0]?.price_per_night || 0;
  }

  /**
   * Рассчитать длительность аренды
   */
  private calculateDuration(dates?: any): { nights: number; months: number } {
    if (!dates) {
      return { nights: 30, months: 1 };
    }

    if (dates.duration_nights) {
      return { nights: dates.duration_nights, months: 0 };
    }

    if (dates.duration_months) {
      return { nights: 0, months: dates.duration_months };
    }

    if (dates.check_in && dates.check_out) {
      const checkIn = new Date(dates.check_in);
      const checkOut = new Date(dates.check_out);
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 28) {
        return { nights: 0, months: Math.floor(diffDays / 30) };
      }
      return { nights: diffDays, months: 0 };
    }

    return { nights: 30, months: 1 };
  }

  /**
   * Проверка особенностей
   */
  private async checkFeatures(propertyId: number, params: SearchParams): Promise<{
    score: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let score = 0;

    if (!params.features || params.features.length === 0) {
      return { score, reasons };
    }

    const [features] = await db.query<RowDataPacket[]>(
      `SELECT feature_type 
       FROM property_features 
       WHERE property_id = ?`,
      [propertyId]
    );

    const propertyFeatures = features.map(f => f.feature_type.toLowerCase());
    const requestedFeatures = params.features.map(f => f.toLowerCase());

    // Обязательные особенности
    const mustHave = params.property_preferences?.must_have_features?.map(f => f.toLowerCase()) || [];
    
    for (const feature of mustHave) {
      if (!propertyFeatures.includes(feature)) {
        score -= 100; // Критично - не подходит
        reasons.push(`Отсутствует обязательная особенность: ${feature}`);
      }
    }

    // Желаемые особенности
    let matchedCount = 0;
    for (const feature of requestedFeatures) {
      if (propertyFeatures.includes(feature)) {
        matchedCount++;
        score += 10;
      }
    }

    if (matchedCount > 0) {
      reasons.push(`Совпадает ${matchedCount} из ${requestedFeatures.length} особенностей`);
    }

    return { score, reasons };
  }

  /**
   * Проверка расположения
   */
  private checkLocation(property: any, params: SearchParams): {
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0;

    if (!params.location_requirements) {
      return { score, reasons };
    }

    // Тихие районы
    const quietAreas = ['Nai Harn', 'Rawai', 'Layan', 'Mai Khao', 'Nai Yang'];
    const infrastructureAreas = ['Kamala', 'Kata', 'Karon', 'Bang Tao', 'Surin', 'Patong'];

    if (params.location_requirements.quiet_area) {
      if (quietAreas.some(area => property.region?.includes(area))) {
        score += 30;
        reasons.push('Тихий район');
      }
    }

    if (params.location_requirements.infrastructure_nearby) {
      if (infrastructureAreas.some(area => property.region?.includes(area))) {
        score += 20;
        reasons.push('Развитая инфраструктура');
      }
    }

    // TODO: Добавить проверку расстояния до пляжа когда будет поле в БД
    // if (params.location_requirements.beach_distance) {
    //   if (property.beach_distance <= params.location_requirements.beach_distance) {
    //     score += 40;
    //     reasons.push(`Близко к пляжу (${property.beach_distance}м)`);
    //   }
    // }

    return { score, reasons };
  }
}

export default new PropertySearchService();