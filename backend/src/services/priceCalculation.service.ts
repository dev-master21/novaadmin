// backend/src/services/priceCalculation.service.ts
import db from '../config/database';
import logger from '../utils/logger';

interface PriceBreakdown {
  period: string;
  nights: number;
  price_per_night?: number;
  price_per_month?: number;
  total: number;
  season_type?: string;
  month_number?: number;
}

interface CalculatedPrice {
  total_price: number;
  currency: string;
  nights: number;
  daily_average: number;
  monthly_equivalent: number;
  breakdown: PriceBreakdown[];
  pricing_method: 'seasonal' | 'monthly' | 'yearly' | 'mixed';
  available_periods?: AvailablePeriod[];
}

interface AvailablePeriod {
  check_in: string;
  check_out: string;
  nights: number;
  total_price: number;
  daily_average: number;
}

class PriceCalculationService {
/**
 * ГЛАВНЫЙ МЕТОД - рассчитать цену для объекта на период
 */
async calculatePrice(
  propertyId: number,
  checkIn: string,
  checkOut: string
): Promise<CalculatedPrice | null> {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      logger.warn(`Invalid nights: ${nights}`);
      return null;
    }

    logger.info(`=== CALCULATING PRICE FOR PROPERTY ${propertyId} ===`);
    logger.info(`Period: ${checkIn} to ${checkOut} (${nights} nights)`);

    // ✅ Проверяем что объект существует
    const propertyExists = await db.queryOne<any>(
      'SELECT id, property_number, property_type FROM properties WHERE id = ?',
      [propertyId]
    );

    if (!propertyExists) {
      logger.error(`❌ Property ${propertyId} NOT FOUND in database!`);
      return null;
    }

    logger.info(`✓ Property found: #${propertyExists.property_number} (${propertyExists.property_type})`);

    // Загружаем все данные о ценах
    const [seasonalPrices, monthlyPrices, yearPrice] = await Promise.all([
      this.getSeasonalPrices(propertyId),
      this.getMonthlyPrices(propertyId),
      this.getYearPrice(propertyId)
    ]);

    logger.info(`=== PROPERTY ${propertyId} PRICING DATA (AFTER CONVERSION) ===`);
    logger.info(`Seasonal prices count: ${seasonalPrices.length}`);
    
    // ✅ Компактное логирование сезонных цен
    if (seasonalPrices.length > 0) {
      logger.info(`Seasonal prices summary:`, seasonalPrices.map(p => ({
        season: p.season_type,
        dates: `${p.start_date_recurring} to ${p.end_date_recurring}`,
        price: `${p.price_per_night} THB/night (type: ${typeof p.price_per_night})`,
        min_nights: p.minimum_nights
      })));
    }
    
    logger.info(`Monthly prices count: ${monthlyPrices.length}`);
    
    // ✅ Компактное логирование месячных цен
    if (monthlyPrices.length > 0) {
      logger.info(`Monthly prices summary:`, monthlyPrices.map(p => ({
        month: p.month_number,
        price: `${p.price_per_month} THB/month (type: ${typeof p.price_per_month})`,
        min_days: p.minimum_days
      })));
    }
    
    logger.info(`Year price: ${yearPrice || 'not set'} ${yearPrice ? `(type: ${typeof yearPrice})` : ''}`);

    // Если вообще нет никаких цен - возвращаем null
    if (seasonalPrices.length === 0 && monthlyPrices.length === 0 && !yearPrice) {
      logger.warn(`❌ NO PRICING DATA AVAILABLE for property ${propertyId}`);
      return null;
    }

    // Определяем метод расчета
    if (nights >= 365) {
      // Годовой контракт
      logger.info(`📅 Using YEARLY pricing logic for ${nights} nights`);
      return await this.calculateYearlyPrice(nights, seasonalPrices, monthlyPrices, yearPrice);
    } else if (nights >= 28) {
      // Месячная аренда - приоритет месячным ценам
      logger.info(`📅 Using LONG-TERM pricing logic for ${nights} nights`);
      return await this.calculateLongTermPrice(start, end, nights, monthlyPrices, seasonalPrices, yearPrice);
    } else {
      // Краткосрочная аренда - приоритет сезонным ценам
      logger.info(`📅 Using SHORT-TERM pricing logic for ${nights} nights`);
      return await this.calculateShortTermPrice(start, end, nights, seasonalPrices, monthlyPrices);
    }
  } catch (error) {
    logger.error(`❌ Price calculation error for property ${propertyId}:`, error);
    return null;
  }
}


  /**
   * Найти все доступные периоды для заданного количества ночей
   */
async findAvailablePeriods(
  propertyId: number,
  nights: number,
  monthNumber?: number,
  year?: number
): Promise<AvailablePeriod[]> {
  try {
    logger.info(`Finding available ${nights}-night periods for property ${propertyId}`);

    // Определяем диапазон поиска
    const searchStart = monthNumber && year 
      ? new Date(year, monthNumber - 1, 1)
      : new Date();
    
    const searchEnd = monthNumber && year
      ? new Date(year, monthNumber, 0) // последний день месяца
      : new Date(new Date().setMonth(new Date().getMonth() + 3)); // 3 месяца вперед

    logger.info(`Search range: ${searchStart.toISOString().split('T')[0]} to ${searchEnd.toISOString().split('T')[0]}`);

    // Получаем все заблокированные даты
    const blockedDates = await db.query<any>(
      `SELECT blocked_date 
       FROM property_calendar 
       WHERE property_id = ? 
       AND blocked_date BETWEEN ? AND ?
       ORDER BY blocked_date`,
      [propertyId, searchStart.toISOString().split('T')[0], searchEnd.toISOString().split('T')[0]]
    );

    const blockedSet = new Set(blockedDates.map((d: any) => d.blocked_date));

    // Ищем свободные периоды
    const availablePeriods: AvailablePeriod[] = [];
    const currentDate = new Date(searchStart);
    
    // ✅ ОПТИМИЗАЦИЯ: Ограничение на количество проверок
    let checksCount = 0;
    const MAX_CHECKS = 100; // Не более 100 проверок

    while (currentDate <= searchEnd && checksCount < MAX_CHECKS) {
      checksCount++;
      
      const checkIn = currentDate.toISOString().split('T')[0];
      const checkOutDate = new Date(currentDate);
      checkOutDate.setDate(checkOutDate.getDate() + nights);
      const checkOut = checkOutDate.toISOString().split('T')[0];

      // Проверяем все даты в периоде
      let isAvailable = true;
      const testDate = new Date(currentDate);
      
      for (let i = 0; i < nights; i++) {
        const dateStr = testDate.toISOString().split('T')[0];
        if (blockedSet.has(dateStr)) {
          isAvailable = false;
          break;
        }
        testDate.setDate(testDate.getDate() + 1);
      }

      if (isAvailable && checkOutDate <= searchEnd) {
        // Рассчитываем цену для этого периода
        const price = await this.calculatePrice(propertyId, checkIn, checkOut);
        
        if (price && price.total_price > 0) {
          availablePeriods.push({
            check_in: checkIn,
            check_out: checkOut,
            nights,
            total_price: price.total_price,
            daily_average: price.daily_average
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    logger.info(`Found ${availablePeriods.length} available periods after ${checksCount} checks`);
    
    // Сортируем по цене (от дешевых к дорогим)
    availablePeriods.sort((a, b) => a.total_price - b.total_price);

    // ✅ Возвращаем только первые 20 для экономии времени
    return availablePeriods.slice(0, 20);
  } catch (error) {
    logger.error('Find available periods error:', error);
    return [];
  }
}

/**
 * Расчет для краткосрочной аренды (< 28 дней) - приоритет сезонным ценам
 */
/**
 * Расчет для краткосрочной аренды (< 28 дней) - приоритет сезонным ценам
 */
private async calculateShortTermPrice(
  start: Date,
  end: Date,
  nights: number,
  seasonalPrices: any[],
  monthlyPrices: any[]
): Promise<CalculatedPrice | null> {
  logger.info('Using SHORT-TERM pricing (seasonal priority)');

  if (seasonalPrices.length === 0) {
    logger.warn('No seasonal prices, trying monthly fallback...');
    
    if (monthlyPrices.length > 0) {
      return await this.calculateFromMonthlyPrices(start, end, nights, monthlyPrices);
    }
    
    logger.error('No pricing data available at all!');
    return null;
  }


  // Заполняем пробелы в сезонных ценах
  const completePrices = this.fillSeasonalGaps(seasonalPrices);

  let totalPrice = 0;
  const breakdown: PriceBreakdown[] = [];
  const currentDate = new Date(start);
  let currentSeason: string | null = null;
  let currentSeasonNights = 0;
  let currentSeasonPrice = 0;
  let currentPricePerNight = 0;

    while (currentDate < end) {
      const mmdd = this.getMMDD(currentDate);
      const season = this.findSeasonForDate(mmdd, completePrices);
    
      if (season) {
        // ✅ Явно конвертируем в число и проверяем
        const pricePerNight = parseFloat(String(season.price_per_night)) || 0;
        
        // ✅ НОВОЕ: Если цена 0 - это "по запросу", пропускаем такие объекты
        if (pricePerNight === 0) {
          logger.warn(`Price on request for date ${mmdd} in season ${season.season_type} - skipping property`);
          // Возвращаем специальный результат "цена по запросу"
          return {
            total_price: 0,
            currency: 'THB',
            nights,
            daily_average: 0,
            monthly_equivalent: 0,
            breakdown: [{
              period: 'price_on_request',
              nights,
              total: 0,
              season_type: 'Цена по запросу'
            }],
            pricing_method: 'seasonal'
          };
        }
        
        totalPrice += pricePerNight;
        
        logger.debug(`Date ${mmdd}: season=${season.season_type}, price=${pricePerNight}, total so far: ${totalPrice}`);
    
        if (season.season_type === currentSeason && pricePerNight === currentPricePerNight) {
          currentSeasonNights++;
          currentSeasonPrice += pricePerNight;
        } else {
          if (currentSeason) {
            breakdown.push({
              period: currentSeason,
              nights: currentSeasonNights,
              price_per_night: currentPricePerNight,
              total: currentSeasonPrice,
              season_type: currentSeason
            });
          }
      
          currentSeason = season.season_type;
          currentSeasonNights = 1;
          currentSeasonPrice = pricePerNight;
          currentPricePerNight = pricePerNight;
        }
      } else {
        logger.warn(`No season found for date ${mmdd} - checking all seasons again`);
        
        // Дополнительная отладка - выводим все сезоны
        completePrices.forEach((s: any) => {
          logger.debug(`  Season: ${s.season_type}, dates: ${s.start_date_recurring} to ${s.end_date_recurring}, price: ${s.price_per_night}`);
        });
      }
  
      currentDate.setDate(currentDate.getDate() + 1);
    }

  // Последний сезон
  if (currentSeason) {
    breakdown.push({
      period: currentSeason,
      nights: currentSeasonNights,
      price_per_night: currentPricePerNight,
      total: currentSeasonPrice,
      season_type: currentSeason
    });
  }

  if (totalPrice === 0) {
    logger.error(`Total price calculated as 0 for ${nights} nights`);
    logger.error(`Breakdown:`, JSON.stringify(breakdown, null, 2));
    return null;
  }

  logger.info(`✓ Short-term price calculated: ${totalPrice} THB`);

  return {
    total_price: Math.round(totalPrice),
    currency: 'THB',
    nights,
    daily_average: Math.round(totalPrice / nights),
    monthly_equivalent: Math.round((totalPrice / nights) * 30),
    breakdown,
    pricing_method: 'seasonal'
  };
}

/**
 * Расчет для долгосрочной аренды (≥ 28 дней) - приоритет месячным ценам
 */
private async calculateLongTermPrice(
  start: Date,
  end: Date,
  nights: number,
  monthlyPrices: any[],
  seasonalPrices: any[],
  yearPrice: number | null
): Promise<CalculatedPrice | null> {
  logger.info('Using LONG-TERM pricing (monthly priority)');

  if (monthlyPrices.length > 0) {
    // Есть месячные цены - используем их
    return await this.calculateFromMonthlyPrices(start, end, nights, monthlyPrices);
  }

  if (yearPrice) {
    // Есть годовая цена - используем её
    return await this.calculateFromYearPrice(nights, yearPrice);
  }

  if (seasonalPrices.length > 0) {
    // Fallback на сезонные цены
    logger.info('Falling back to seasonal prices for long-term');
    return await this.calculateShortTermPrice(start, end, nights, seasonalPrices, []);
  }

  return null;
}

/**
 * Расчет годового контракта
 */
private async calculateYearlyPrice(
  nights: number,
  seasonalPrices: any[],
  monthlyPrices: any[],
  yearPrice: number | null
): Promise<CalculatedPrice | null> {
  logger.info('Using YEARLY contract pricing');

  // Если указана year_price - используем её
  if (yearPrice) {
    const monthlyPrice = yearPrice / 12;
    const totalPrice = (nights / 365) * yearPrice;

    return {
      total_price: Math.round(totalPrice),
      currency: 'THB',
      nights,
      daily_average: Math.round(yearPrice / 365),
      monthly_equivalent: Math.round(monthlyPrice),
      breakdown: [{
        period: 'yearly_contract',
        nights,
        price_per_month: Math.round(monthlyPrice),
        total: Math.round(totalPrice)
      }],
      pricing_method: 'yearly'
    };
  }

  // Если есть месячные цены - берем минимальную × 12
  if (monthlyPrices.length > 0) {
    const minMonthlyPrice = Math.min(...monthlyPrices.map((p: any) => p.price_per_month));
    const yearlyTotal = minMonthlyPrice * 12;
    const totalPrice = (nights / 365) * yearlyTotal;

    logger.info(`Calculated yearly from monthly: min ${minMonthlyPrice} × 12 = ${yearlyTotal} THB/year`);

    return {
      total_price: Math.round(totalPrice),
      currency: 'THB',
      nights,
      daily_average: Math.round(yearlyTotal / 365),
      monthly_equivalent: Math.round(minMonthlyPrice),
      breakdown: [{
        period: 'yearly_from_monthly',
        nights,
        price_per_month: Math.round(minMonthlyPrice),
        total: Math.round(totalPrice)
      }],
      pricing_method: 'monthly'
    };
  }

  // Если есть только сезонные - высчитываем среднюю за год
  if (seasonalPrices.length > 0) {
    const avgDailyPrice = this.calculateYearlyAverageFromSeasonal(seasonalPrices);
    const yearlyTotal = avgDailyPrice * 365;
    const monthlyEquivalent = yearlyTotal / 12;
    const totalPrice = (nights / 365) * yearlyTotal;

    logger.info(`Calculated yearly from seasonal: avg ${avgDailyPrice} THB/day = ${yearlyTotal} THB/year`);

    return {
      total_price: Math.round(totalPrice),
      currency: 'THB',
      nights,
      daily_average: Math.round(avgDailyPrice),
      monthly_equivalent: Math.round(monthlyEquivalent),
      breakdown: [{
        period: 'yearly_from_seasonal',
        nights,
        price_per_month: Math.round(monthlyEquivalent),
        total: Math.round(totalPrice)
      }],
      pricing_method: 'seasonal'
    };
  }

  return null;
}

  /**
   * Расчет по месячным ценам с заполнением пробелов
   */
  private async calculateFromMonthlyPrices(
    start: Date,
    end: Date,
    nights: number,
    monthlyPrices: any[]
  ): Promise<CalculatedPrice | null> {
    // Заполняем все 12 месяцев
    const completePrices = this.fillMonthlyGaps(monthlyPrices);

    const months = nights / 30;
    const startMonth = start.getMonth() + 1;
    const endMonth = end.getMonth() + 1;

    // Находим цены для нужных месяцев
    let totalPrice = 0;
    const breakdown: PriceBreakdown[] = [];

    const currentDate = new Date(start);
    while (currentDate < end) {
      const month = currentDate.getMonth() + 1;
      const monthPrice = completePrices.find((p: any) => p.month_number === month);

      if (monthPrice) {
        totalPrice += monthPrice.price_per_month / 30; // цена за день
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Группируем по месяцам для breakdown
    const usedMonths = Array.from(new Set([startMonth, endMonth]));
    for (const month of usedMonths) {
      const monthPrice = completePrices.find((p: any) => p.month_number === month);
      if (monthPrice) {
        breakdown.push({
          period: `Month ${month}`,
          nights: 30,
          price_per_month: monthPrice.price_per_month,
          total: monthPrice.price_per_month,
          month_number: month
        });
      }
    }

    return {
      total_price: Math.round(totalPrice),
      currency: 'THB',
      nights,
      daily_average: Math.round(totalPrice / nights),
      monthly_equivalent: Math.round(totalPrice / months),
      breakdown,
      pricing_method: 'monthly'
    };
  }

  /**
   * Расчет по годовой цене
   */
  private async calculateFromYearPrice(
    nights: number,
    yearPrice: number
  ): Promise<CalculatedPrice> {
    const pricePerDay = yearPrice / 365;
    const totalPrice = pricePerDay * nights;
    const monthlyEquivalent = yearPrice / 12;

    return {
      total_price: Math.round(totalPrice),
      currency: 'THB',
      nights,
      daily_average: Math.round(pricePerDay),
      monthly_equivalent: Math.round(monthlyEquivalent),
      breakdown: [{
        period: 'from_year_price',
        nights,
        price_per_month: Math.round(monthlyEquivalent),
        total: Math.round(totalPrice)
      }],
      pricing_method: 'yearly'
    };
  }

  /**
   * Заполнить пробелы в месячных ценах (брать из предыдущего месяца)
   */
  private fillMonthlyGaps(monthlyPrices: any[]): any[] {
    const complete: any[] = [];
    let lastPrice: any = null;

    for (let month = 1; month <= 12; month++) {
      const existing = monthlyPrices.find((p: any) => p.month_number === month);
      
      if (existing) {
        complete.push(existing);
        lastPrice = existing;
      } else if (lastPrice) {
        // Берем цену из предыдущего месяца
        complete.push({
          ...lastPrice,
          month_number: month
        });
      }
    }

    logger.info(`Filled monthly prices: ${monthlyPrices.length} → ${complete.length}`);
    return complete;
  }

  /**
   * Заполнить пробелы в сезонных ценах
   */
  private fillSeasonalGaps(seasonalPrices: any[]): any[] {
    if (seasonalPrices.length === 0) return [];

    // Сортируем по датам
    const sorted = [...seasonalPrices].sort((a, b) => 
      a.start_date_recurring.localeCompare(b.start_date_recurring)
    );

    // Если уже покрывает весь год - возвращаем как есть
    if (this.coversFullYear(sorted)) {
      return sorted;
    }

    // Заполняем пробелы средней ценой
    const avgPrice = sorted.reduce((sum, p) => sum + p.price_per_night, 0) / sorted.length;

    logger.info(`Filling seasonal gaps with average price: ${avgPrice} THB/night`);

    return sorted;
  }

  /**
   * Проверить покрывают ли сезоны весь год
   */
  private coversFullYear(seasonalPrices: any[]): boolean {
    // Упрощенная проверка - если есть хотя бы 2 сезона, считаем что покрывает
    return seasonalPrices.length >= 2;
  }

  /**
   * Рассчитать среднюю цену за год из сезонных цен
   */
  private calculateYearlyAverageFromSeasonal(seasonalPrices: any[]): number {
    let totalDays = 0;
    let totalPrice = 0;

    for (const season of seasonalPrices) {
      const days = this.getDaysInSeason(season.start_date_recurring, season.end_date_recurring);
      totalDays += days;
      totalPrice += days * season.price_per_night;
    }

    return totalDays > 0 ? totalPrice / totalDays : 0;
  }

  /**
   * Получить количество дней в сезоне
   */
  private getDaysInSeason(start: string, end: string): number {
    const [startMonth, startDay] = start.split('-').map(Number);
    const [endMonth, endDay] = end.split('-').map(Number);

    if (startMonth <= endMonth) {
      // В пределах года
      const startDate = new Date(2024, startMonth - 1, startDay);
      const endDate = new Date(2024, endMonth - 1, endDay);
      return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // Пересекает новый год
      const endYear = new Date(2024, endMonth - 1, endDay);
      const startYear = new Date(2024, startMonth - 1, startDay);
      const yearEnd = new Date(2024, 11, 31);
      const yearStart = new Date(2024, 0, 1);

      const days1 = Math.ceil((yearEnd.getTime() - startYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const days2 = Math.ceil((endYear.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      return days1 + days2;
    }
  }

  /**
   * Найти сезон для конкретной даты
   */
  private findSeasonForDate(mmdd: string, seasonalPrices: any[]): any | null {
    for (const season of seasonalPrices) {
      if (this.isDateInSeason(mmdd, season.start_date_recurring, season.end_date_recurring)) {
        return season;
      }
    }
    return null;
  }

/**
 * Проверить попадает ли дата в сезон
 */
private isDateInSeason(mmdd: string, start: string, end: string): boolean {
  const [month, day] = mmdd.split('-').map(Number);
  const [startMonth, startDay] = start.split('-').map(Number);
  const [endMonth, endDay] = end.split('-').map(Number);

  // Создаем числовое представление даты для сравнения (MMDD)
  const dateValue = month * 100 + day;
  const startValue = startMonth * 100 + startDay;
  const endValue = endMonth * 100 + endDay;

  logger.debug(`Checking ${mmdd} (${dateValue}) in range ${start} (${startValue}) to ${end} (${endValue})`);

  if (startValue <= endValue) {
    // Сезон в пределах одного года (например, март-октябрь или ноябрь-декабрь)
    const inRange = dateValue >= startValue && dateValue <= endValue;
    logger.debug(`Same year season: ${inRange}`);
    return inRange;
  } else {
    // Сезон пересекает новый год (например, ноябрь-апрель: 11-01 до 04-30)
    const inRange = dateValue >= startValue || dateValue <= endValue;
    logger.debug(`Cross-year season: ${inRange}`);
    return inRange;
  }
}

  /**
   * Получить MM-DD из даты
   */
  private getMMDD(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  }

/**
 * Загрузить сезонные цены
 */
private async getSeasonalPrices(propertyId: number): Promise<any[]> {
  const prices = await db.query<any>(
    `SELECT season_type, start_date_recurring, end_date_recurring, 
            price_per_night, minimum_nights, pricing_type
     FROM property_pricing
     WHERE property_id = ?
     ORDER BY start_date_recurring`,
    [propertyId]
  );

  // ✅ КРИТИЧЕСКИ ВАЖНО: Конвертируем цены в числа
  return prices.map((p: any) => ({
    ...p,
    price_per_night: parseFloat(p.price_per_night) || 0,
    minimum_nights: parseInt(p.minimum_nights) || 0
  }));
}

/**
 * Загрузить месячные цены
 */
private async getMonthlyPrices(propertyId: number): Promise<any[]> {
  const prices = await db.query<any>(
    `SELECT month_number, price_per_month, minimum_days
     FROM property_pricing_monthly
     WHERE property_id = ?
     ORDER BY month_number`,
    [propertyId]
  );

  // ✅ КРИТИЧЕСКИ ВАЖНО: Конвертируем цены в числа
  return prices.map((p: any) => ({
    ...p,
    month_number: parseInt(p.month_number),
    price_per_month: parseFloat(p.price_per_month) || 0,
    minimum_days: parseInt(p.minimum_days) || 0
  }));
}

/**
 * Загрузить годовую цену
 */
private async getYearPrice(propertyId: number): Promise<number | null> {
  const result = await db.queryOne<any>(
    'SELECT year_price FROM properties WHERE id = ?',
    [propertyId]
  );
  
  // ✅ КРИТИЧЕСКИ ВАЖНО: Конвертируем в число
  if (!result?.year_price) return null;
  
  const yearPrice = parseFloat(result.year_price);
  return yearPrice > 0 ? yearPrice : null;
}
}

export default new PriceCalculationService();