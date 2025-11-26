// backend/src/services/aiPropertyCreation.service.ts
import { config } from '../config/config';
import logger from '../utils/logger';
import axios from 'axios';

interface PropertyData {
  // Основная информация
  property_number?: string;
  property_name?: string;
  complex_name?: string;
  deal_type?: 'sale' | 'rent' | 'both';
  property_type?: 'villa' | 'apartment' | 'condo' | 'penthouse' | 'house' | 'land';
  region?: string;
  address?: string;
  google_maps_link?: string;
  latitude?: number;  // ✅ ДОБАВИТЬ
  longitude?: number; // ✅ ДОБАВИТЬ

  // Размеры
  bedrooms?: number;
  bathrooms?: number;
  indoor_area?: number;
  outdoor_area?: number;
  plot_size?: number;
  
  // Этажи и строительство
  floors?: number;
  floor?: string;
  construction_year?: number;
  construction_month?: string;
  
  // Дополнительно
  furniture_status?: string;
  parking_spaces?: number;
  pets_allowed?: string;
  
  // Владение (для продажи)
  building_ownership?: 'freehold' | 'leasehold' | 'company';
  land_ownership?: 'freehold' | 'leasehold' | 'company';
  ownership_type?: 'freehold' | 'leasehold' | 'company';
  
// Комиссии
  sale_commission_type?: 'percentage' | 'fixed';
  sale_commission_value?: number;
  rent_commission_type?: 'percentage' | 'fixed';
  rent_commission_value?: number;
  
  // Реновация
  renovation_type?: 'partial' | 'full';
  renovation_date?: string;

  // Цены
  sale_price?: number;
  year_price?: number;
  
  // Владелец
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  owner_telegram?: string;
  owner_instagram?: string;
  owner_notes?: string;
  
  // Депозит и коммунальные
  deposit_type?: string;
  deposit_amount?: number;
  electricity_rate?: number;
  water_rate?: number;
  rental_includes?: string;
  
  // Дополнительно
  video_url?: string;
  status: 'draft';
  
  // Особенности
  propertyFeatures?: string[];
  outdoorFeatures?: string[];
  rentalFeatures?: string[];
  locationFeatures?: string[];
  views?: string[];
  
  // Цены
  seasonalPricing?: Array<{
    season_type?: string;
    start_date_recurring: string;
    end_date_recurring: string;
    price_per_night: number;
    minimum_nights?: number;
    pricing_type: 'perNight' | 'perPeriod';
  }>;
  
  monthlyPricing?: Array<{
    month_number: number;
    price_per_month: number;
    minimum_days?: number;
  }>;
  
  // Занятость календаря
  blockedDates?: Array<{
    blocked_date: string;
    reason: string;
  }>;
  
  // Фотографии
  photosFromGoogleDrive?: string; // URL
}

class AIPropertyCreationService {
  private isEnabled: boolean = false;
  private provider: 'openai' | 'claude' = 'openai';
  private proxyUrl: string = '';
  private proxySecret: string = '';

  constructor() {
    this.provider = config.ai.provider as 'openai' | 'claude';
    this.proxyUrl = config.ai.proxyUrl || '';
    this.proxySecret = config.ai.proxySecret || '';

    if (this.proxyUrl && this.proxySecret) {
      this.isEnabled = true;
      logger.info(`AI Property Creation service configured`);
    } else {
      logger.warn('AI Proxy not configured - AI property creation will be disabled');
    }
  }

  isAIEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Основной метод: парсинг текста и извлечение данных об объекте
   */
  async parsePropertyFromText(text: string): Promise<PropertyData> {
    if (!this.isAIEnabled()) {
      throw new Error('AI сервис недоступен.');
    }

    try {
      if (this.provider === 'openai') {
        return await this.parseWithOpenAI(text);
      } else {
        return await this.parseWithClaude(text);
      }
    } catch (error: any) {
      logger.error('AI property creation error:', error);
      throw this.handleAIError(error);
    }
  }

  /**
   * Парсинг через OpenAI
   */
  private async parseWithOpenAI(text: string): Promise<PropertyData> {
    const systemPrompt = this.buildPropertyCreationSystemPrompt();
    
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Проанализируй следующее описание объекта недвижимости и извлеки ВСЕ возможные данные:\n\n"${text}"\n\nВерни структурированный JSON ответ согласно инструкциям.`
      }
    ];

    logger.info('Sending property text to OpenAI via proxy');

    const response = await axios.post(
      `${this.proxyUrl}/api/openai/chat/completions`,
      {
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.proxySecret}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000
      }
    );

    const responseText = response.data.choices[0]?.message?.content || '{}';
    logger.info('OpenAI property creation response received');

    const propertyData: PropertyData = JSON.parse(responseText);
    
    // Валидация и нормализация данных
    return this.normalizePropertyData(propertyData);
  }

  
  /**
   * Парсинг через Claude
   */
  private async parseWithClaude(text: string): Promise<PropertyData> {
    const systemPrompt = this.buildPropertyCreationSystemPrompt();

    const messages = [
      {
        role: 'user',
        content: `Проанализируй следующее описание объекта недвижимости и извлеки ВСЕ возможные данные:\n\n"${text}"\n\nВерни структурированный JSON ответ согласно инструкциям.`
      }
    ];

    logger.info('Sending property text to Claude via proxy');

    const response = await axios.post(
      `${this.proxyUrl}/api/claude/messages`,
      {
        model: config.ai.claude.model,
        max_tokens: 4000,
        system: systemPrompt,
        messages
      },
      {
        headers: {
          'Authorization': `Bearer ${this.proxySecret}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000
      }
    );

    const responseText = response.data.content[0]?.type === 'text' 
      ? response.data.content[0].text 
      : '';

    logger.info('Claude property creation response received');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Claude response');
    }

    const propertyData: PropertyData = JSON.parse(jsonMatch[0]);
    
    return this.normalizePropertyData(propertyData);
  }

/**
 * Нормализация и валидация данных
 */
private normalizePropertyData(data: PropertyData): PropertyData {
  // ✅ КРИТИЧЕСКИ ВАЖНО: Рекурсивно заменяем ВСЕ пустые строки на undefined
  const cleanData = this.deepCleanEmptyStrings(data);
  
  // Теперь работаем с очищенными данными
  data = cleanData as PropertyData;
  
  // Гарантируем статус draft
  data.status = 'draft';
  
  // Конвертация цен в THB
  if (data.sale_price) {
    data.sale_price = this.convertToTHB(data.sale_price, 'THB');
  }
  
  if (data.year_price) {
    data.year_price = this.convertToTHB(data.year_price, 'THB');
  }
  
  // Нормализация сезонных цен
  if (data.seasonalPricing && Array.isArray(data.seasonalPricing)) {
    data.seasonalPricing = data.seasonalPricing
      .filter(price => {
        return price.start_date_recurring && 
               price.end_date_recurring && 
               price.price_per_night && 
               price.price_per_night > 0;
      })
      .map(price => ({
        ...price,
        price_per_night: this.convertToTHB(price.price_per_night, 'THB'),
        minimum_nights: price.minimum_nights || 1,
        pricing_type: price.pricing_type || 'perPeriod'
      }));
    
    if (data.seasonalPricing.length === 0) {
      data.seasonalPricing = undefined;
    }
  }
  
  // Нормализация месячных цен
  if (data.monthlyPricing && Array.isArray(data.monthlyPricing)) {
    data.monthlyPricing = data.monthlyPricing
      .filter(price => {
        return price.month_number && 
               price.month_number >= 1 && 
               price.month_number <= 12 &&
               price.price_per_month && 
               price.price_per_month > 0;
      })
      .map(price => ({
        ...price,
        price_per_month: this.convertToTHB(price.price_per_month, 'THB'),
        minimum_days: price.minimum_days || 1
      }));
    
    if (data.monthlyPricing.length === 0) {
      data.monthlyPricing = undefined;
    }
  }
  
  // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Конвертируем features из snake_case в camelCase
  if (data.propertyFeatures) {
    data.propertyFeatures = this.convertFeaturesToCamelCase(
      data.propertyFeatures.filter(f => f && f !== '')
    );
  }
  if (data.outdoorFeatures) {
    data.outdoorFeatures = this.convertFeaturesToCamelCase(
      data.outdoorFeatures.filter(f => f && f !== '')
    );
  }
  if (data.rentalFeatures) {
    data.rentalFeatures = this.convertFeaturesToCamelCase(
      data.rentalFeatures.filter(f => f && f !== '')
    );
  }
  if (data.locationFeatures) {
    data.locationFeatures = this.convertFeaturesToCamelCase(
      data.locationFeatures.filter(f => f && f !== '')
    );
  }
  if (data.views) {
    data.views = this.convertFeaturesToCamelCase(
      data.views.filter(v => v && v !== '')
    );
  }
  
  // ✅ Валидация ENUM полей
  const validFurnitureStatuses = ['fullyFurnished', 'partiallyFurnished', 'unfurnished', 'builtIn', 'empty'];
  if (data.furniture_status && !validFurnitureStatuses.includes(data.furniture_status)) {
    data.furniture_status = undefined;
  }
  
  const validDepositTypes = ['fixed', 'monthly', 'none'];
  if (data.deposit_type && !validDepositTypes.includes(data.deposit_type)) {
    data.deposit_type = undefined;
  }
  
  const validOwnershipTypes = ['freehold', 'leasehold', 'company'];
  if (data.building_ownership && !validOwnershipTypes.includes(data.building_ownership)) {
    data.building_ownership = undefined;
  }
  if (data.land_ownership && !validOwnershipTypes.includes(data.land_ownership)) {
    data.land_ownership = undefined;
  }
  if (data.ownership_type && !validOwnershipTypes.includes(data.ownership_type)) {
    data.ownership_type = undefined;
  }
  
  const validPetsAllowed = ['yes', 'no', 'negotiable', 'custom'];
  if (!data.pets_allowed || !validPetsAllowed.includes(data.pets_allowed)) {
    data.pets_allowed = 'yes';
  }
  
  const validCommissionTypes = ['percentage', 'fixed'];
  if (data.sale_commission_type && !validCommissionTypes.includes(data.sale_commission_type)) {
    data.sale_commission_type = undefined;
  }
  if (data.rent_commission_type && !validCommissionTypes.includes(data.rent_commission_type)) {
    data.rent_commission_type = undefined;
  }
  
  const validRenovationTypes = ['partial', 'full'];
  if (data.renovation_type && !validRenovationTypes.includes(data.renovation_type)) {
    data.renovation_type = undefined;
  }
  
  const validPropertyTypes = ['villa', 'apartment', 'condo', 'penthouse', 'house', 'land'];
  if (data.property_type && !validPropertyTypes.includes(data.property_type)) {
    data.property_type = undefined;
  }
  
  const validDealTypes = ['sale', 'rent', 'both'];
  if (!data.deal_type || !validDealTypes.includes(data.deal_type)) {
    data.deal_type = 'rent';
  }
  
  const validRegions = ['bangtao', 'kamala', 'surin', 'layan', 'rawai', 'patong', 'kata', 'karon', 'naiharn', 'maikhao', 'chalong', 'phukettown', 'naiyang', 'cherngtalay'];
  if (data.region && !validRegions.includes(data.region)) {
    data.region = undefined;
  }
  
  return data;
}

/**
 * ✅ ИСПРАВЛЕННЫЙ: Конвертация snake_case в camelCase с обработкой цифр
 */
private snakeToCamel(str: string): string {
  // Специальные случаи для features с цифрами в начале
  const specialCases: { [key: string]: string } = {
    'security_24_7': '24hSecurity',
    '24h_security': '24hSecurity',
    'concierge_24h': '24hConcierge',
    '24h_concierge': '24hConcierge',
    'ensuite_bathroom': 'ensuiteBathroom'
  };
  
  // Проверяем специальные случаи
  if (specialCases[str]) {
    return specialCases[str];
  }
  
  // Обычная конвертация snake_case в camelCase
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}


/**
 * ✅ НОВЫЙ МЕТОД: Конвертация массива features из snake_case в camelCase
 */
private convertFeaturesToCamelCase(features: string[]): string[] {
  return features.map(f => this.snakeToCamel(f));
}

/**
 * ✅ СУЩЕСТВУЮЩИЙ МЕТОД: Рекурсивная очистка пустых строк и null
 */
private deepCleanEmptyStrings(obj: any): any {
  if (obj === null || obj === '' || obj === undefined) {
    return undefined;
  }
  
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== null && item !== '' && item !== undefined)
      .map(item => this.deepCleanEmptyStrings(item));
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = this.deepCleanEmptyStrings(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  
  return obj;
}

/**
 * Системный промпт для создания объекта
 */
private buildPropertyCreationSystemPrompt(): string {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();
  
  return `Ты - AI ассистент для компании NOVA Estate по автоматическому созданию объектов недвижимости из текстового описания.

## ТЕКУЩАЯ ДАТА:
Сегодня: ${currentDay}.${currentMonth}.${currentYear} (день.месяц.год)
Текущий год: ${currentYear}
Текущий месяц: ${currentMonth}

Используй эту информацию при определении дат занятости, года постройки и других временных параметров.

## ТВОЯ ЗАДАЧА:
Извлечь МАКСИМАЛЬНО ВСЕ данные из текста и преобразовать их в структурированный JSON для создания объекта недвижимости.

## КРИТИЧЕСКИ ВАЖНО - ФОРМАТ ДАННЫХ:
1. ВСЕ ENUM ПОЛЯ: либо валидное значение, либо null (НЕ пустую строку "")
2. МАССИВЫ: НЕ добавляй элементы если данных недостаточно
3. FEATURES: ТОЛЬКО значения из списков ниже (в snake_case)

Если значение неизвестно или не указано в тексте - используй **null**, НЕ пустую строку "".

Пример ПРАВИЛЬНО:
{
  "furniture_status": "fullyFurnished"  // Если указано
}
{
  "furniture_status": null  // Если НЕ указано
}

Пример НЕПРАВИЛЬНО:
{
  "furniture_status": ""  // ❌ НИКОГДА НЕ ИСПОЛЬЗУЙ ПУСТЫЕ СТРОКИ
}

## ❌ КРИТИЧЕСКИ ВАЖНО ДЛЯ МАССИВОВ:
**НИКОГДА НЕ ДОБАВЛЯЙ ЭЛЕМЕНТЫ МАССИВА ЕСЛИ ДАННЫХ НЕДОСТАТОЧНО!**

**seasonalPricing**: ДОБАВЛЯЙ ТОЛЬКО если есть ВСЕ ОБЯЗАТЕЛЬНЫЕ поля:
- start_date_recurring (дата начала периода)
- end_date_recurring (дата конца периода)
- price_per_night (цена за ночь)

Если хотя бы ОДНО из этих полей отсутствует - НЕ ДОБАВЛЯЙ элемент в массив!

**monthlyPricing**: ДОБАВЛЯЙ ТОЛЬКО если есть ВСЕ ОБЯЗАТЕЛЬНЫЕ поля:
- month_number (номер месяца 1-12)
- price_per_month (цена за месяц)

Если month_number неизвестен - НЕ ДОБАВЛЯЙ элемент в массив!

**blockedDates**: ДОБАВЛЯЙ ТОЛЬКО если есть ВСЕ ОБЯЗАТЕЛЬНЫЕ поля:
- blocked_date (конкретная дата в формате YYYY-MM-DD)
- reason (причина блокировки)

Если конкретных дат нет - НЕ ДОБАВЛЯЙ элементы в массив!

Пример ПРАВИЛЬНО:
Текст: "Высокий сезон 220000 в месяц"
JSON: "monthlyPricing": []  // ❌ НЕТ month_number - массив пустой!

Текст: "Январь 220000, февраль 180000"
JSON: "monthlyPricing": [
  {"month_number": 1, "price_per_month": 220000, "minimum_days": 1},
  {"month_number": 2, "price_per_month": 180000, "minimum_days": 1}
]  // ✅ Есть month_number для каждого месяца

## КРИТИЧЕСКИ ВАЖНО - КОНВЕРТАЦИЯ ВАЛЮТ:
**ВСЕ ЦЕНЫ ДОЛЖНЫ БЫТЬ В ТАЙСКИХ БАТАХ (THB)**

Курсы конвертации:
- 1 USD = 35 THB
- 1 EUR = 38 THB  
- 1 RUB = 0.38 THB

**ОПРЕДЕЛЕНИЕ ВАЛЮТЫ ПО КОНТЕКСТУ:**
- Если написано "рублей", "руб", "₽", "р." → RUB → конвертируем в THB
- Если написано "долларов", "баксов", "$", "USD" → USD → конвертируем в THB
- Если написано "бат", "батов", "THB", "฿" → THB → оставляем как есть
- Если написано "евро", "€", "EUR" → EUR → конвертируем в THB
- **Если просто число БЕЗ указания валюты → THB (по умолчанию)**

**ВАЖНО:** На Пхукете цены обычно в батах, поэтому если валюта НЕ указана явно - считаем что это баты!

Примеры:
"200 тысяч" → 200,000 THB (по умолчанию баты)
"200 тысяч рублей" → 76,000 THB (200,000 * 0.38)
"5000 долларов" → 175,000 THB (5,000 * 35)
"100к батов" → 100,000 THB
"55 млн" → 55,000,000 THB (по умолчанию баты)
"220'000" → 220,000 THB (по умолчанию баты, игнорируем апострофы)

## ОСНОВНАЯ ИНФОРМАЦИЯ:

**property_number** (обязательно): Номер объекта. Примеры: "55", "L6", "V123", "123A"
Если номер не указан явно - используй часть названия или "1"

**property_name** (желательно): Название объекта. Примеры: "Anchan Flora", "Laguna Village", "Sea View Villa"

**complex_name**: Название комплекса. Примеры: "Anchan Flora", "Laguna", "Bang Tao Beach"

**deal_type** (обязательно):
- "sale" если только продажа
- "rent" если только аренда
- "both" если и продажа и аренда

**property_type**:
- "villa" - вилла
- "apartment" - апартаменты
- "condo" - кондо
- "penthouse" - пентхаус
- "house" - дом
- "land" - земля

**region**: Регион на Пхукете
Варианты: "bangtao", "kamala", "surin", "layan", "rawai", "patong", "kata", "karon", "naiharn", "maikhao", "chalong", "phukettown", "naiyang", "cherngtalay"

**address**: Точный адрес объекта

**google_maps_link**: Ссылка на Google Maps

**bedrooms**: Количество спален (число)
Ключевые слова: "спальня", "спальни", "bedroom", "BR", "комнатная" (например "1 комнатная" = 1 спальня)

**bathrooms**: Количество ванных (число)
**indoor_area**: Внутренняя площадь в м² (число)
**outdoor_area**: Внешняя площадь в м² (число)
**plot_size**: Размер участка в м² (число)

**floors**: Количество этажей В объекте (число) - например "2 этажа" → floors: 2
**floor**: НА каком этаже находится ("1", "2", "1-2", "ground") - например "на 3 этаже" → floor: "3"

**construction_year**: Год постройки (число, например 2024)
**construction_month**: Месяц постройки ("01"-"12")

**furniture_status**: Меблировка
- "fullyFurnished" - полностью меблирована
- "partiallyFurnished" - частично
- "unfurnished" - без мебели
- "builtIn" - встроенная мебель
- "empty" - пустая

**parking_spaces**: Количество парковочных мест (число)

**pets_allowed**: Разрешены ли животные
- "yes" - разрешены (по умолчанию если не сказано иначе)
- "no" - не разрешены
- "negotiable" - по договоренности
- "custom" - особые условия

**renovation_type**: Тип реновации
- "partial" - частичная
- "full" - полная
- null - нет реновации

**renovation_date**: Дата реновации (формат "YYYY-MM-01")

## ТИПЫ ВЛАДЕНИЯ (только для deal_type = "sale" или "both"):

**ownership_type**: Основной тип владения
**building_ownership**: Владение зданием
**land_ownership**: Владение землей

Варианты для всех трех:
- "freehold" - фрихолд, полная собственность
- "leasehold" - лизхолд, аренда на срок
- "company" - через компанию (ключевые слова: "BVI Leasehold", "через компанию", "company")

## ЦЕНЫ:

**sale_price**: Цена продажи в THB (только для sale/both)
**year_price**: Годовая цена аренды в THB (для rent/both)

**seasonalPricing**: Массив сезонных цен
⚠️ ДОБАВЛЯЙ ЭЛЕМЕНТ ТОЛЬКО ЕСЛИ ЕСТЬ ВСЕ 3 ОБЯЗАТЕЛЬНЫХ ПОЛЯ!
Каждый элемент ДОЛЖЕН содержать:
{
  "start_date_recurring": "MM-DD" (ОБЯЗАТЕЛЬНО! дата начала, например "12-15"),
  "end_date_recurring": "MM-DD" (ОБЯЗАТЕЛЬНО! дата конца, например "02-28"),
  "price_per_night": число в THB (ОБЯЗАТЕЛЬНО!),
  "season_type": "Название сезона" (опционально),
  "minimum_nights": минимум ночей (по умолчанию 1),
  "pricing_type": "perNight" или "perPeriod" (по умолчанию "perPeriod")
}

Если нет конкретных дат начала/конца - оставь массив ПУСТЫМ []

**monthlyPricing**: Массив месячных цен
⚠️ ДОБАВЛЯЙ ЭЛЕМЕНТ ТОЛЬКО ЕСЛИ ИЗВЕСТЕН КОНКРЕТНЫЙ МЕСЯЦ!
Каждый элемент ДОЛЖЕН содержать:
{
  "month_number": номер месяца 1-12 (ОБЯЗАТЕЛЬНО!),
  "price_per_month": цена в месяц в THB (ОБЯЗАТЕЛЬНО!),
  "minimum_days": минимум дней (по умолчанию 1)
}

Примеры извлечения month_number:
"январь" → 1
"февраль" → 2
"высокий сезон" → НЕТ конкретного месяца → НЕ ДОБАВЛЯЙ В МАССИВ
"декабрь-февраль 200к" → [
  {"month_number": 12, "price_per_month": 200000, "minimum_days": 1},
  {"month_number": 1, "price_per_month": 200000, "minimum_days": 1},
  {"month_number": 2, "price_per_month": 200000, "minimum_days": 1}
]

**РАЗЛИЧИЕ СЕЗОННЫХ И МЕСЯЧНЫХ ЦЕН:**
- Сезонные: конкретный период с ДАТАМИ "с 15 декабря по 13 февраля - 200к за ночь"
- Месячные: по МЕСЯЦАМ "февраль 200т, январь 300т"
- Если просто "высокий сезон 220к" БЕЗ конкретных месяцев/дат → оставь ОБА массива ПУСТЫМИ

## КОМИССИИ:

**sale_commission_type**: "percentage" | "fixed" | null
**sale_commission_value**: число
**rent_commission_type**: "percentage" | "fixed" | null
**rent_commission_value**: число

Примеры:
"Комиссия 3%" → sale_commission_type: "percentage", sale_commission_value: 3
"Комиссия 50 тысяч" → sale_commission_type: "fixed", sale_commission_value: 50000
"Комиссия агента 5% от аренды" → rent_commission_type: "percentage", rent_commission_value: 5

## ВЛАДЕЛЕЦ:

**owner_name**: Имя владельца
**owner_phone**: Телефон владельца
**owner_email**: Email владельца
**owner_telegram**: Telegram (@username или без @)
**owner_instagram**: Instagram (@username или без @)
**owner_notes**: Дополнительные заметки о владельце

## ДЕПОЗИТ И КОММУНАЛЬНЫЕ:

**deposit_type**: "fixed" | "monthly" | "none" | null
**deposit_amount**: Сумма депозита в THB (только если deposit_type = "fixed")
**electricity_rate**: Стоимость электричества (THB за единицу)
**water_rate**: Стоимость воды (THB за единицу)
**rental_includes**: Что включено в стоимость аренды (текст)

## ⚠️ КРИТИЧЕСКИ ВАЖНО ДЛЯ FEATURES:
**НИКОГДА НЕ ПРИДУМЫВАЙ СВОИ ЗНАЧЕНИЯ!**

Если нужной особенности нет в списке - НЕ ДОБАВЛЯЙ ЕЁ!

Примеры ПРАВИЛЬНО:
Текст: "автоматические ворота" → "electricGate" (из списка)
Текст: "джакузи" → "jacuzzi" (из списка)
Текст: "рядом пляж" → "beachAccess" (из списка)

Примеры НЕПРАВИЛЬНО:
Текст: "автоматические ворота" → "automaticGate" ❌ (нет в списке!)
Текст: "рядом пляж" → "nearBeach" ❌ (нет в списке!)
**ИСПОЛЬЗУЙ ТОЛЬКО ЗНАЧЕНИЯ ИЗ СПИСКОВ ОСОБЕННОСТЕЙ НИЖЕ!**

## FEATURES - ИСПОЛЬЗУЙ ТОЛЬКО ИЗ ЭТИХ СПИСКОВ:

**property**: Массив строк. Доступные значения:
    // Комнаты и помещения
    'mediaRoom',
    'privateGym',
    'privateLift',
    'privateSauna',
    'jacuzzi',
    'cornerUnit',
    'maidsQuarters',
    'duplex',
    'triplex',
    'balcony',
    'study',
    'library',
    'winecellar',
    'elevator',
    'homeElevator',
    'gameRoom',
    'billiardRoom',
    'kidsRoom',
    'nursery',
    'guestRoom',
    'serviceRoom',
    'utilityRoom',
    'pantry',
    'wetRoom',
    'powderRoom',
    'ensuiteBathroom',
    'sharedBathroom',
    'outdoorBathroom',
    'steamRoom',
    'hammam',
    'massage',
    'yogaRoom',
    'meditationRoom',
    'artStudio',
    'workshop',
    
    // Кухня и ванная
    'westernKitchen',
    'thaiKitchen',
    'openKitchen',
    'closedKitchen',
    'bathtub',
    'shower',
    'separateShower',
    
    // Бассейны
    'privatePool',
    'sharedPool',
    'infinityPool',
    'kidPool',
    
    // Системы безопасности
    'smartHome',
    'securitySystem',
    'cctv',
    'alarmSystem',
    'intercom',
    'videoIntercom',
    'safebox',
    
    // Климат-контроль
    'airConditioning',
    'centralAC',
    'heating',
    'floorHeating',
    'fireplace',
    
    // Энергетика
    'solarPanels',
    'waterHeater',
    'solarWaterHeater',
    'generator',
    'ups',
    
    // Архитектурные особенности
    'highCeiling',
    'largeWindows',
    'floorToFloorWindows',
    'walkinCloset',
    'builtinWardrobe',
    'separateEntrance',
    'privateEntrance',
    'soundproofing',
    
    // Системы очистки
    'waterFiltration',
    'airPurifier',
    
    // Техника
    'washer',
    'dryer',
    'dishwasher',
    'refrigerator',
    'microwave',
    'oven',
    'stove',
    'gasStove',
    'electricStove',
    'inductionStove',
    'coffeemaker',
    'waterDispenser',
    
    // Развлечения
    'tv',
    'smartTV',
    'wifi',
    'highSpeedInternet',
    'fiberOptic',
    'telephone',
    'satelliteTV',
    'surround',
    'homeTheater',
    'musicSystem',
    'piano',
    
    // Меблировка и состояние
    'furnished',
    'partiallyFurnished',
    'fullyEquipped',
    'euroRenovation',
    'designerRenovation',
    'modernDesign',
    'traditionalStyle',
    'minimalist',
    'luxury',
    
    // Планировка
    'penthouseLevel',
    'groundFloor',
    'topFloor',
    'multiLevel',
    'studio',
    'openPlan',
    
    // Доступность
    'petFriendly',
    'childFriendly',
    'wheelchair',
    'disabledAccess',
    'ramp',
    
    // Безопасность
    'emergencyExit',
    'fireExtinguisher',
    'firstAidKit',
    'smokeDetector',
    'carbonMonoxide',
    
    // Экология
    'eco',
    'energyEfficient',
    'sustainable',
    'greenBuilding',
    'leed',
    
    // Статус
    'newConstruction',
    'underConstruction',
    'readyToMove',
    'offPlan',
    'resale'

**outdoor**: Массив строк. Доступные значения:
    // Сад и ландшафт
    'garden',
    'privateGarden',
    'landscaped',
    'tropicalGarden',
    'japaneseGarden',
    'vegetableGarden',
    'fruitTrees',
    'flowerGarden',
    
    // Террасы и крыши
    'terrace',
    'rooftop',
    'rooftopTerrace',
    'skyGarden',
    
    // Зоны отдыха и готовки
    'bbqArea',
    'outdoorKitchen',
    'outdoorShower',
    'beachShower',
    'summerKitchen',
    'outdoorDining',
    'lounge',
    'sunbeds',
    'sunshade',
    'pergola',
    'gazebo',
    'pavilion',
    
    // Парковка
    'garage',
    'carport',
    'coveredParking',
    'openParking',
    'secureParking',
    'guestParking',
    'electricCarCharger',
    'bikestorage',
    
    // Водные элементы
    'poolBar',
    'fountain',
    'pond',
    'koiPond',
    'waterfall',
    'streambed',
    
    // Детские зоны
    'playground',
    'swingSet',
    'slide',
    'sandbox',
    'trampoline',
    
    // Зоны для животных
    'petArea',
    'dogRun',
    'petShower',
    
    // Хранение и хозяйство
    'storageRoom',
    'shed',
    'greenhouse',
    'laundryRoom',
    'dryingArea',
    
    // Спортивные площадки
    'outdoorGym',
    'sportsArea',
    'tennisCourt',
    'basketballCourt',
    'footballField',
    'volleyball',
    'badminton',
    'puttingGreen',
    'bocce',
    'skatepark',
    'joggingTrack',
    'walkingPath',
    'cyclingPath',
    
    // Водный доступ
    'fishingPier',
    'boatDock',
    'marina',
    'beachAccess',
    'privateBeach',
    'beachCabana',
    
    // Ограждение и безопасность
    'fence',
    'wall',
    'gate',
    'electricGate',
    'securityGate',
    'driveway',
    'pavedDriveway',
    'gravelDriveway',
    
    // Освещение
    'streetLighting',
    'gardenLighting',
    'securityLighting',
    'decorativeLighting',
    
    // Системы полива
    'sprinklerSystem',
    'automaticSprinklers',
    'drip',
    'irrigationSystem',
    'rainwaterCollection',
    
    // Водоснабжение
    'well',
    'borehole',
    'waterTank',
    'waterPump',
    'septicTank',
    'sewageSystem',
    'drainageSystem'


**rental**: Массив строк. Доступные значения:
    // Услуги персонала
    'maidService',
    'dailyCleaning',
    'weeklyCleaning',
    'chefService',
    'privateChef',
    'cateringService',
    'driverService',
    
    // Трансфер и транспорт
    'airportTransfer',
    'carRental',
    'bicycleRental',
    'scooterRental',
    'boatRental',
    'kayakRental',
    
    // Питание
    'breakfastIncluded',
    'halfBoard',
    'fullBoard',
    'allInclusive',
    
    // Уборка и стирка
    'cleaning',
    'linenChange',
    'towelChange',
    'laundryService',
    'dryClean',
    'ironing',
    
    // Коммунальные услуги
    'utilitiesIncluded',
    'electricityIncluded',
    'waterIncluded',
    'gasIncluded',
    'wifiIncluded',
    'internetIncluded',
    'cableTv',
    'streamingServices',
    
    // Сервисы
    'conciergeService',
    '24hConcierge',
    'securityGuard',
    '24hSecurity',
    'management',
    'propertyManagement',
    'maintenance',
    'repairService',
    'gardenMaintenance',
    'poolMaintenance',
    'pestControl',
    'wasteDisposal',
    'recycling',
    
    // Уход
    'petCare',
    'petSitting',
    'dogWalking',
    'babysitting',
    'childcare',
    'eldercare',
    
    // Медицина
    'medicalService',
    'nurseOnCall',
    'doctorOnCall',
    'ambulance',
    'pharmacy',
    
    // Доставка
    'grocery',
    'shopping',
    'delivery',
    'courierService',
    'mailHandling',
    'packageReceiving',
    
    // Автосервис
    'valetParking',
    'carWash',
    'carService',
    
    // Водные виды спорта
    'snorkeling',
    'divingEquipment',
    'fishing',
    'surfingLessons',
    'kitesurfing',
    'wakeboarding',
    'jetski',
    'parasailing',
    'bananaBoat',
    'speedboat',
    'yachtCharter',
    
    // Премиум услуги
    'helicopterService',
    'privatePlane',
    'limousineService',
    
    // Бронирование
    'tourBooking',
    'ticketBooking',
    'restaurantReservation',
    'spaBooking',
    
    // Красота и здоровье
    'massageService',
    'beautyService',
    'hairSalon',
    'nailSalon',
    
    // Спорт и фитнес
    'personalTrainer',
    'yogaInstructor',
    'pilatesInstructor',
    'tennisCoach',
    'golfCoach',
    'swimInstructor',
    
    // Мероприятия
    'eventPlanning',
    'partyPlanning',
    'weddingPlanning',
    'catering',
    'florist',
    'photographer',
    'videographer',
    'musician',
    'dj',
    'entertainer',
    
    // Профессиональные услуги
    'translation',
    'interpreter',
    'legalService',
    'lawyer',
    'notary',
    'accounting',
    'taxService',
    'insurance',
    'visaAssistance',
    'immigration',
    'relocation',
    
    // Аренда
    'storage',
    'furnitureRental',
    'applianceRental',
    
    // Типы аренды
    'shortTermRental',
    'longTermRental',
    'monthlyRental',
    'weeklyRental',
    'dailyRental',
    
    // Условия заезда
    'flexibleCheckIn',
    'lateCheckOut',
    'earlyCheckIn',
    
    // Оплата
    'depositRequired',
    'noDeposit',
    'creditCardRequired',
    'cashPayment',
    'bankTransfer',
    'onlinePayment',
    'installmentPlan',
    
    // Скидки
    'discountAvailable',
    'seasonalDiscount',
    'longStayDiscount',
    'earlyBooking',
    'lastMinute',
    'studentDiscount',
    'seniorDiscount',
    'militaryDiscount',
    'corporateRate',
    'groupRate',
    
    // Правила
    'noSmoking',
    'smokingAllowed',
    'noPets',
    'noParties',
    'quietHours',
    'noiseCurfew',
    'minimumAge',
    'adultsOnly',
    'familyFriendly',
    'kidfriendly',
    'infantFriendly',
    'teenagerFriendly'

**location**: Массив строк. Доступные значения:
    // Пляж
    'beachAccess',
    'beachFront',
    'secondLine',
    'walkToBeach',
    
    // Образование
    'nearSchool',
    'nearInternationalSchool',
    'nearKindergarten',
    'nearUniversity',
    
    // Медицина
    'nearHospital',
    'nearClinic',
    'nearPharmacy',
    
    // Магазины
    'nearSupermarket',
    'nearConvenience',
    'nearMarket',
    'nearMall',
    'nearShops',
    
    // Рестораны и бары
    'nearRestaurant',
    'nearCafe',
    'nearBar',
    'nearNightlife',
    
    // Спорт и отдых
    'nearGolfCourse',
    'nearMarina',
    'nearYachtClub',
    'nearTennisCourt',
    'nearBasketball',
    'nearFootball',
    'nearVolleyball',
    'nearSkatepark',
    'nearGym',
    'nearFitness',
    'nearYoga',
    'nearSpa',
    'nearWellness',
    
    // Транспорт
    'nearAirport',
    'nearBusStop',
    'nearBusTerminal',
    'nearTaxiStand',
    'nearMetro',
    'nearTrain',
    'nearHighway',
    'nearMainRoad',
    
    // Сервисы
    'nearBank',
    'nearAtm',
    'nearPostOffice',
    'nearPolice',
    'nearFireStation',
    'nearEmbassy',
    'nearGovernment',
    'nearSalon',
    'nearVet',
    'nearPetShop',
    
    // Религия
    'nearTemple',
    'nearMosque',
    'nearChurch',
    'nearSynagogue',
    
    // Природа
    'nearPark',
    'nearPlayground',
    'nearGarden',
    'nearForest',
    'nearMountain',
    'nearLake',
    'nearRiver',
    'nearWaterfall',
    'nearNationalPark',
    'nearNatureReserve',
    
    // Развлечения
    'nearZoo',
    'nearAquarium',
    'nearMuseum',
    'nearGallery',
    'nearTheater',
    'nearCinema',
    'nearConcertHall',
    'nearStadium',
    'nearSportsCenter',
    'nearLibrary',
    'nearBookstore',
    
    // Туризм
    'nearTouristAttraction',
    'nearLandmark',
    'nearViewpoint',
    'nearDiveSite',
    'nearSurfSpot',
    'nearSnorkeling',
    'nearHiking',
    'nearCycling',
    'nearJogging',
    
    // Характер района
    'quietArea',
    'peacefulLocation',
    'residentialArea',
    'commercialArea',
    'businessDistrict',
    'touristArea',
    'localArea',
    'expatArea',
    'internationalCommunity',
    'gatedCommunity',
    'secureComplex',
    'privateCommunity',
    'luxuryDevelopment',
    'newDevelopment',
    'establishedArea',
    'upAndComing',
    'trendyArea',
    'historicDistrict',
    'culturalQuarter',
    'artDistrict',
    'entertainmentDistrict',
    'financialDistrict',
    'shoppingDistrict',
    
    // Расположение в городе
    'cityCentre',
    'cityCenter',
    'downtown',
    'midtown',
    'uptown',
    'suburb',
    'outskirts',
    'countryside',
    'rural',
    'urban',
    'metropolitan',
    
    // Географическое положение
    'coastal',
    'inland',
    'hillside',
    'hilltop',
    'valley',
    'plateau',
    'peninsula',
    'island',
    'mainland',
    'waterfront',
    'riverside',
    'lakeside',
    'mountainside',
    'forestEdge',
    'parkside',
    
    // Зонирование
    'greenBelt',
    'openSpace',
    'lowDensity',
    'highDensity',
    'mixedUse',
    'liveworkPlay',
    'masterPlanned',
    'smartCity',
    'ecoVillage',
    'sustainableCommunity',
    
    // Транспортная доступность
    'walkable',
    'bikeFriendly',
    'publicTransport',
    'transitOriented',
    'carDependent',
    'carFree',
    'pedestrianZone',
    
    // Дорожная обстановка
    'lowTraffic',
    'noThroughTraffic',
    'deadEnd',
    'culDeSac',
    'mainStreet',
    'sideStreet',
    'privateStreet',
    'pavedRoad',
    'dirtRoad',
    'streetParking',
    
    // Безопасность района
    'wellLit',
    'darkAtNight',
    'safeArea',
    'lowCrime',
    
    // Общество
    'neighborhood',
    'communitySpirit',
    'familyOriented',
    'professionalArea',
    'studentArea',
    'retirementCommunity'

**views**: Массив строк. Доступные значения:
    // Морские виды
    'seaView',
    'oceanView',
    'beachView',
    'bayView',
    'coastalView',
    'partialSeaView',
    'glimpseOfSea',
    'distantSeaView',
    
    // Природные виды
    'sunsetView',
    'sunriseView',
    'mountainView',
    'hillView',
    'volcanoView',
    'forestView',
    'lakeView',
    'riverView',
    'waterfallView',
    'pondView',
    
    // Виды на территорию
    'poolView',
    'gardenView',
    'parkView',
    
    // Городские виды
    'cityView',
    'skylineView',
    
    // Характер вида
    'panoramicView',
    'unobstructedView',
    '180View',
    '360View',
    'scenicView',
    'spectacularView',
    'breathtakingView',
    'stunningView',
    'magnificentView',
    'beautifulView',
    'niceView',
    'pleasantView',
    
    // С точки обзора
    'rooftopView',
    'balconyView',
    'terraceView',
    'windowView',
    'floorToFloorView',
    'elevatedView',
    'groundLevelView',
    'skylightView',
    
    // Внутренние виды
    'noView',
    'obstructedView',
    'limitedView',
    'interiorView',
    'courtyardView',
    'atriumView',
    
    // Виды на объекты
    'streetView',
    'roadView',
    'parkingView',
    'neighborView',
    'wallView',
    'buildingView',
    'roofView',
    'towerView',
    'bridgeView',
    
    // Культурные объекты
    'monumentView',
    'templeView',
    'palaceView',
    'castleView',
    'stadiumView',
    
    // Транспортные объекты
    'airportView',
    'portView',
    'marinaView',
    'yachtView',
    'boatView',
    'shipView',
    
    // Прочее
    'islandView',
    'horizonView',
    'clearView',
    'privateView',
    'sharedView',
    
    // Стороны света
    'facingNorth',
    'facingSouth',
    'facingEast',
    'facingWest',
    'northeastView',
    'northwestView',
    'southeastView',
    'southwestView'

## СЛОВАРЬ РУССКИХ ТЕРМИНОВ → АНГЛИЙСКИЕ FEATURES:

**Базовые удобства:**
- джакузи, жаккузи → "jacuzzi"
- ванна → "bathtub"
- душ, душевая кабина → "shower"
- отдельный душ → "separate_shower"
- сауна → "sauna"
- паровая → "steam_room"
- хаммам → "hammam"

**Кухня:**
- кухня, оборудованная кухня → "kitchen"
- европейская кухня → "western_kitchen"
- посудомойка, посудомоечная машина → "dishwasher"
- стиралка, стиральная машина → "washing_machine"
- сушилка → "dryer"
- микроволновка, СВЧ → "microwave"
- духовка, духовая плита → "oven"
- холодильник → "refrigerator"
- винный холодильник → "winecellar"
- кофемашина, кофеварка → "coffee_maker"

**Техника и системы:**
- кондиционер, кондиционеры → "air_conditioning"
- телевизор → "tv"
- смарт ТВ, умный телевизор → "smart_tv"
- интернет, WiFi, вайфай → "wifi"
- высокоскоростной интернет → "high_speed_internet"
- домофон → "intercom"
- видеонаблюдение → "cctv"
- сигнализация → "alarm_system"
- умный дом → "smart_home"
- солнечные батареи, солнечные панели → "solar_panels"
- водонагреватель → "water_heater"
- сейф → "safe"

**Мебель и пространство:**
- балкон → "balcony"
- терраса → "terrace"
- высокие потолки → "high_ceiling"
- большие окна → "large_windows"
- гардеробная → "walkin_closet"
- встроенный шкаф → "builtin_wardrobe"

**Внешние особенности:**
- бассейн, личный бассейн → "private_pool"
- общий бассейн → "shared_pool"
- сад, личный сад → "private_garden"
- парковка → "parking"
- крытая парковка → "covered_parking"
- гараж → "garage"
- автоматические ворота, электрические ворота → "electric_gate"
- уличный душ → "outdoor_shower"
- барбекю, BBQ → "bbq"
- беседка → "gazebo"
- пергола → "pergola"
- фонтан → "fountain"
- подъездная дорога → "driveway"
- асфальтированная дорога → "paved_driveway"
- спортзал → "gym"

**Аренда:**
- охрана 24/7 → "security_24_7"
- уборка → "maid_service"
- услуги горничной → "maid_service"
- смена белья → "linen_change"
- консьерж → "concierge_service"

**Расположение:**
- рядом пляж, у пляжа → "beach_access"
- первая линия → "beach_front"
- рядом школа → "near_school"
- рядом больница → "near_hospital"
- рядом супермаркет → "near_supermarket"
- рядом магазины → "near_shops"
- рядом рестораны → "near_restaurant"
- рядом гольф → "near_golf_course"
- рядом парк → "near_park"
- рядом аквапарк, водный парк → "near_aquarium"
- закрытый комплекс, закрытый поселок → "gated_community"
- охраняемый комплекс → "secure_complex"
- тихий район → "quiet_area"
- безопасный район → "safe_area"

**Виды:**
- вид на море → "sea_view"
- вид на океан → "ocean_view"
- вид на горы → "mountain_view"
- вид на бассейн → "pool_view"
- вид на сад → "garden_view"
- панорамный вид → "panoramic_view"

## ЗАНЯТОСТЬ КАЛЕНДАРЯ:

**blockedDates**: Массив заблокированных дат
⚠️ ДОБАВЛЯЙ ТОЛЬКО если есть КОНКРЕТНЫЕ ДАТЫ!
Каждый элемент ДОЛЖЕН содержать:
{
  "blocked_date": "YYYY-MM-DD" (ОБЯЗАТЕЛЬНО! конкретная дата),
  "reason": "Причина" (ОБЯЗАТЕЛЬНО!)
}

Примеры:
"Занято с 15 декабря до 5 февраля" → генерируй КАЖДЫЙ день в этом периоде
"Занято в январе" → генерируй все дни января текущего года (${currentYear})

Если просто "занято" БЕЗ конкретных дат → оставь массив ПУСТЫМ []

## ФОТОГРАФИИ И ВИДЕО:

**photosFromGoogleDrive**: Ссылка на папку/файлы Google Drive
**video_url**: URL видео (YouTube, Vimeo и т.д.)

## СТАТУС:

**status**: ВСЕГДА "draft" (черновик)

## ФОРМАТ ОТВЕТА:

Верни СТРОГО валидный JSON со ВСЕМИ извлеченными данными:

{
  "property_number": string,
  "property_name": string | null,
  "complex_name": string | null,
  "deal_type": "sale" | "rent" | "both",
  "property_type": string | null,
  "region": string | null,
  "address": string | null,
  "google_maps_link": string | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "indoor_area": number | null,
  "outdoor_area": number | null,
  "plot_size": number | null,
  "floors": number | null,
  "floor": string | null,
  "construction_year": number | null,
  "construction_month": string | null,
  "furniture_status": string | null,
  "parking_spaces": number | null,
  "pets_allowed": "yes" | "no" | "negotiable" | "custom",
  "renovation_type": "partial" | "full" | null,
  "renovation_date": string | null,
  "building_ownership": string | null,
  "land_ownership": string | null,
  "ownership_type": string | null,
  "sale_price": number | null,
  "year_price": number | null,
  "sale_commission_type": "percentage" | "fixed" | null,
  "sale_commission_value": number | null,
  "rent_commission_type": "percentage" | "fixed" | null,
  "rent_commission_value": number | null,
  "owner_name": string | null,
  "owner_phone": string | null,
  "owner_email": string | null,
  "owner_telegram": string | null,
  "owner_instagram": string | null,
  "owner_notes": string | null,
  "deposit_type": "fixed" | "monthly" | "none" | null,
  "deposit_amount": number | null,
  "electricity_rate": number | null,
  "water_rate": number | null,
  "rental_includes": string | null,
  "video_url": string | null,
  "status": "draft",
  "propertyFeatures": string[],
  "outdoorFeatures": string[],
  "rentalFeatures": string[],
  "locationFeatures": string[],
  "views": string[],
  "seasonalPricing": array | null,
  "monthlyPricing": array | null,
  "blockedDates": array | null,
  "photosFromGoogleDrive": string | null
}

## ПРИМЕРЫ:

### ПРИМЕР 1: Полное описание с продажей и арендой
Текст: "Объект Anchan Flora, номер 55. Цена на продажу 55млн бат, комиссия 3%. Аренда 200т с января по март, в остальное время 300к, годовой контракт аренды 150к, комиссия агента 5%. 2 этажа, 500кв внутри, 1000 не жилая, 1200 участок. Фрихолд. Построен в 2020 году, декабрь. Полностью меблирована. Можно с питомцами, Район Бангтао, 3 спальни 2 ванны, парковочных места 2. По особенностям: Оборудованная кухня, телевизор, интернет, кондиционер, бассейн, сад. Вид на море. В аренду входит уборка 2 раза в неделю. Депозит 1 месяц аренды. Электричество 8 бат/юнит, вода 25 бат/юнит. Занятость с декабря 15го числа до 5го февраля занято Сергеем. Ссылка на гугл мапс: https://maps.app.goo.gl/fisGYUvwpuaexkES7, фотки тут: https://drive.google.com/drive/folders/1-jwxIprOx4YrCFPrXKOVNUQOYQYXZqLo Собственник Анна, тел +66123456789, email anna@test.com, telegram @anna_phuket"

JSON:
{
  "property_number": "55",
  "property_name": "Anchan Flora",
  "complex_name": "Anchan Flora",
  "deal_type": "both",
  "property_type": "villa",
  "region": "bangtao",
  "address": null,
  "google_maps_link": "https://maps.app.goo.gl/fisGYUvwpuaexkES7",
  "bedrooms": 3,
  "bathrooms": 2,
  "indoor_area": 500,
  "outdoor_area": 1000,
  "plot_size": 1200,
  "floors": 2,
  "floor": null,
  "construction_year": 2020,
  "construction_month": "12",
  "furniture_status": "fullyFurnished",
  "parking_spaces": 2,
  "pets_allowed": "yes",
  "renovation_type": null,
  "renovation_date": null,
  "ownership_type": "freehold",
  "building_ownership": "freehold",
  "land_ownership": "freehold",
  "sale_price": 55000000,
  "year_price": 150000,
  "sale_commission_type": "percentage",
  "sale_commission_value": 3,
  "rent_commission_type": "percentage",
  "rent_commission_value": 5,
  "owner_name": "Анна",
  "owner_phone": "+66123456789",
  "owner_email": "anna@test.com",
  "owner_telegram": "@anna_phuket",
  "owner_instagram": null,
  "owner_notes": null,
  "deposit_type": "monthly",
  "deposit_amount": null,
  "electricity_rate": 8,
  "water_rate": 25,
  "rental_includes": "Уборка 2 раза в неделю",
  "video_url": null,
  "status": "draft",
  "propertyFeatures": ["kitchen", "smart_tv", "wifi", "air_conditioning"],
  "outdoorFeatures": ["private_pool", "garden", "parking"],
  "rentalFeatures": ["maid_service"],
  "locationFeatures": [],
  "views": ["sea_view"],
  "seasonalPricing": [],
  "monthlyPricing": [
    {"month_number": 1, "price_per_month": 200000, "minimum_days": 1},
    {"month_number": 2, "price_per_month": 200000, "minimum_days": 1},
    {"month_number": 3, "price_per_month": 200000, "minimum_days": 1},
    {"month_number": 4, "price_per_month": 300000, "minimum_days": 1},
    {"month_number": 5, "price_per_month": 300000, "minimum_days": 1},
    {"month_number": 6, "price_per_month": 300000, "minimum_days": 1},
    {"month_number": 7, "price_per_month": 300000, "minimum_days": 1},
    {"month_number": 8, "price_per_month": 300000, "minimum_days": 1},
    {"month_number": 9, "price_per_month": 300000, "minimum_days": 1},
    {"month_number": 10, "price_per_month": 300000, "minimum_days": 1},
    {"month_number": 11, "price_per_month": 300000, "minimum_days": 1},
    {"month_number": 12, "price_per_month": 300000, "minimum_days": 1}
  ],
  "blockedDates": [
    {"blocked_date": "2024-12-15", "reason": "Занято Сергеем"},
    {"blocked_date": "2024-12-16", "reason": "Занято Сергеем"},
    ... каждый день до ...
    {"blocked_date": "2025-02-05", "reason": "Занято Сергеем"}
  ],
  "photosFromGoogleDrive": "https://drive.google.com/drive/folders/1-jwxIprOx4YrCFPrXKOVNUQOYQYXZqLo"
}

### ПРИМЕР 2: Аренда с депозитом и реновацией
Текст: "Кондо 42 в комплексе Laguna Heights. Только аренда. На 5 этаже. 2 спальни, 1 ванная. 80кв внутри. Построена в 2015, полная реновация была в январе 2023. Полностью меблирована. Кухня, стиралка, кондиционеры, WiFi, балкон. Общий бассейн, спортзал. Охрана 24/7. Месячная аренда: январь-апрель 45000 бат, май-октябрь 35000 бат, ноябрь-декабрь 50000 бат. Минимум 3 месяца. Депозит 60000 бат. Собственник Михаил, инстаграм @mikhail_phuket"

JSON:
{
  "property_number": "42",
  "property_name": null,
  "complex_name": "Laguna Heights",
  "deal_type": "rent",
  "property_type": "condo",
  "region": null,
  "address": null,
  "google_maps_link": null,
  "bedrooms": 2,
  "bathrooms": 1,
  "indoor_area": 80,
  "outdoor_area": null,
  "plot_size": null,
  "floors": null,
  "floor": "5",
  "construction_year": 2015,
  "construction_month": null,
  "furniture_status": "fullyFurnished",
  "parking_spaces": null,
  "pets_allowed": "yes",
  "renovation_type": "full",
  "renovation_date": "2023-01-01",
  "ownership_type": null,
  "building_ownership": null,
  "land_ownership": null,
  "sale_price": null,
  "year_price": null,
  "sale_commission_type": null,
  "sale_commission_value": null,
  "rent_commission_type": null,
  "rent_commission_value": null,
  "owner_name": "Михаил",
  "owner_phone": null,
  "owner_email": null,
  "owner_telegram": null,
  "owner_instagram": "@mikhail_phuket",
  "owner_notes": null,
  "deposit_type": "fixed",
  "deposit_amount": 60000,
  "electricity_rate": null,
  "water_rate": null,
  "rental_includes": null,
  "video_url": null,
  "status": "draft",
  "propertyFeatures": ["kitchen", "washing_machine", "air_conditioning", "wifi", "balcony"],
  "outdoorFeatures": ["shared_pool", "gym"],
  "rentalFeatures": ["security_24_7"],
  "locationFeatures": [],
  "views": [],
  "seasonalPricing": [],
  "monthlyPricing": [
    {"month_number": 1, "price_per_month": 45000, "minimum_days": 90},
    {"month_number": 2, "price_per_month": 45000, "minimum_days": 90},
    {"month_number": 3, "price_per_month": 45000, "minimum_days": 90},
    {"month_number": 4, "price_per_month": 45000, "minimum_days": 90},
    {"month_number": 5, "price_per_month": 35000, "minimum_days": 90},
    {"month_number": 6, "price_per_month": 35000, "minimum_days": 90},
    {"month_number": 7, "price_per_month": 35000, "minimum_days": 90},
    {"month_number": 8, "price_per_month": 35000, "minimum_days": 90},
    {"month_number": 9, "price_per_month": 35000, "minimum_days": 90},
    {"month_number": 10, "price_per_month": 35000, "minimum_days": 90},
    {"month_number": 11, "price_per_month": 50000, "minimum_days": 90},
    {"month_number": 12, "price_per_month": 50000, "minimum_days": 90}
  ],
  "blockedDates": [],
  "photosFromGoogleDrive": null
}

### ПРИМЕР 3: Продажа с BVI Leasehold и комиссией
Текст: "Вилла V88 на Камале. Только продажа 35 миллионов батов. BVI Leasehold. Комиссия агента 100 тысяч батов фиксированная. Двухэтажная, 4 спальни, 3 ванные. 280кв внутри, 150кв терраса, участок 400кв. Год постройки 2022, апрель. Частичная реновация в марте 2024. Есть всё: кухня европейская, посудомойка, стиралка, сушилка, духовка, микроволновка, кофемашина, сейф, умный дом, система безопасности, видеонаблюдение. Личный бассейн, джакузи, сауна, терраса, BBQ, крытая парковка на 2 машины. Вид на море и горы. Тихий район, рядом рестораны и магазины, 500м до пляжа. Собственник Елена Иванова, email elena@example.com, telegram @elena88"

JSON:
{
  "property_number": "V88",
  "property_name": null,
  "complex_name": null,
  "deal_type": "sale",
  "property_type": "villa",
  "region": "kamala",
  "address": null,
  "google_maps_link": null,
  "bedrooms": 4,
  "bathrooms": 3,
  "indoor_area": 280,
  "outdoor_area": 150,
  "plot_size": 400,
  "floors": 2,
  "floor": null,
  "construction_year": 2022,
  "construction_month": "04",
  "furniture_status": "fullyFurnished",
  "parking_spaces": 2,
  "pets_allowed": "yes",
  "renovation_type": "partial",
  "renovation_date": "2024-03-01",
  "ownership_type": "company",
  "building_ownership": "company",
  "land_ownership": "company",
  "sale_price": 35000000,
  "year_price": null,
  "sale_commission_type": "fixed",
  "sale_commission_value": 100000,
  "rent_commission_type": null,
  "rent_commission_value": null,
  "owner_name": "Елена Иванова",
  "owner_phone": null,
  "owner_email": "elena@example.com",
  "owner_telegram": "@elena88",
  "owner_instagram": null,
  "owner_notes": null,
  "deposit_type": null,
  "deposit_amount": null,
  "electricity_rate": null,
  "water_rate": null,
  "rental_includes": null,
  "video_url": null,
  "status": "draft",
  "propertyFeatures": ["kitchen", "dishwasher", "washing_machine", "dryer", "oven", "microwave", "coffee_maker", "safe", "smart_home", "security_system", "cctv", "jacuzzi", "sauna"],
  "outdoorFeatures": ["private_pool", "terrace", "bbq", "covered_parking"],
  "rentalFeatures": [],
  "locationFeatures": ["quiet_area", "near_restaurants", "near_shops", "beach_access"],
  "views": ["sea_view", "mountain_view"],
  "seasonalPricing": [],
  "monthlyPricing": [],
  "blockedDates": [],
  "photosFromGoogleDrive": null
}

### ПРИМЕР 4: Сезонные цены с минимальным сроком
Текст: "Апартаменты A15 в Патонге. 1 спальня, 1 ванная, 45кв. На первом этаже. Построена в 2018. Без мебели. Аренда только на сезон: с 15 декабря по 28 февраля - 80 тысяч батов за ночь, минимум 30 ночей. Депозит нет. Питомцы не разрешены. Владелец John Smith, phone +66987654321"

JSON:
{
  "property_number": "A15",
  "property_name": null,
  "complex_name": null,
  "deal_type": "rent",
  "property_type": "apartment",
  "region": "patong",
  "address": null,
  "google_maps_link": null,
  "bedrooms": 1,
  "bathrooms": 1,
  "indoor_area": 45,
  "outdoor_area": null,
  "plot_size": null,
  "floors": null,
  "floor": "1",
  "construction_year": 2018,
  "construction_month": null,
  "furniture_status": "unfurnished",
  "parking_spaces": null,
  "pets_allowed": "no",
  "renovation_type": null,
  "renovation_date": null,
  "ownership_type": null,
  "building_ownership": null,
  "land_ownership": null,
  "sale_price": null,
  "year_price": null,
  "sale_commission_type": null,
  "sale_commission_value": null,
  "rent_commission_type": null,
  "rent_commission_value": null,
  "owner_name": "John Smith",
  "owner_phone": "+66987654321",
  "owner_email": null,
  "owner_telegram": null,
  "owner_instagram": null,
  "owner_notes": null,
  "deposit_type": "none",
  "deposit_amount": null,
  "electricity_rate": null,
  "water_rate": null,
  "rental_includes": null,
  "video_url": null,
  "status": "draft",
  "propertyFeatures": [],
  "outdoorFeatures": [],
  "rentalFeatures": [],
  "locationFeatures": [],
  "views": [],
  "seasonalPricing": [
    {
      "season_type": "Высокий сезон",
      "start_date_recurring": "12-15",
      "end_date_recurring": "02-28",
      "price_per_night": 80000,
      "minimum_nights": 30,
      "pricing_type": "perNight"
    }
  ],
  "monthlyPricing": [],
  "blockedDates": [],
  "photosFromGoogleDrive": null
}

### ПРИМЕР 5: Цены в рублях с конвертацией
Текст: "Пентхаус PH7 на Равае. 3 спальни, 2 ванные, 150кв. Продажа 28 миллионов рублей или аренда 180 тысяч рублей в месяц. Фрихолд. Комиссия при продаже 2%, при аренде фиксированная 20 тысяч рублей. Депозит при аренде 2 месяца. Построен в 2021, полная меблировка. Панорамный вид на море, личный бассейн на крыше, спортзал, сауна, парковка. Видео: https://youtu.be/example. Собственник Дмитрий, тел +79001234567, telegram @dmitry_ph7"

JSON:
{
  "property_number": "PH7",
  "property_name": null,
  "complex_name": null,
  "deal_type": "both",
  "property_type": "penthouse",
  "region": "rawai",
  "address": null,
  "google_maps_link": null,
  "bedrooms": 3,
  "bathrooms": 2,
  "indoor_area": 150,
  "outdoor_area": null,
  "plot_size": null,
  "floors": null,
  "floor": null,
  "construction_year": 2021,
  "construction_month": null,
  "furniture_status": "fullyFurnished",
  "parking_spaces": null,
  "pets_allowed": "yes",
  "renovation_type": null,
  "renovation_date": null,
  "ownership_type": "freehold",
  "building_ownership": "freehold",
  "land_ownership": "freehold",
  "sale_price": 10640000,
  "year_price": null,
  "sale_commission_type": "percentage",
  "sale_commission_value": 2,
  "rent_commission_type": "fixed",
  "rent_commission_value": 7600,
  "owner_name": "Дмитрий",
  "owner_phone": "+79001234567",
  "owner_email": null,
  "owner_telegram": "@dmitry_ph7",
  "owner_instagram": null,
  "owner_notes": null,
  "deposit_type": "monthly",
  "deposit_amount": null,
  "electricity_rate": null,
  "water_rate": null,
  "rental_includes": null,
  "video_url": "https://youtu.be/example",
  "status": "draft",
  "propertyFeatures": ["gym", "sauna"],
  "outdoorFeatures": ["private_pool", "parking"],
  "rentalFeatures": [],
  "locationFeatures": [],
  "views": ["panoramic_view", "sea_view"],
  "seasonalPricing": [],
  "monthlyPricing": [
    {"month_number": 1, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 2, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 3, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 4, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 5, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 6, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 7, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 8, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 9, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 10, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 11, "price_per_month": 68400, "minimum_days": 60},
    {"month_number": 12, "price_per_month": 68400, "minimum_days": 60}
  ],
  "blockedDates": [],
  "photosFromGoogleDrive": null
}

## КРИТИЧЕСКОЕ ПРАВИЛО ДЛЯ ENUM ПОЛЕЙ:

Эти поля могут иметь ТОЛЬКО указанные значения или null:

**furniture_status**: "fullyFurnished" | "partiallyFurnished" | "unfurnished" | "builtIn" | "empty" | null
**deposit_type**: "fixed" | "monthly" | "none" | null
**building_ownership**: "freehold" | "leasehold" | "company" | null
**land_ownership**: "freehold" | "leasehold" | "company" | null
**ownership_type**: "freehold" | "leasehold" | "company" | null
**pets_allowed**: "yes" | "no" | "negotiable" | "custom" (по умолчанию "yes")
**sale_commission_type**: "percentage" | "fixed" | null
**rent_commission_type**: "percentage" | "fixed" | null
**renovation_type**: "partial" | "full" | null
**property_type**: "villa" | "apartment" | "condo" | "penthouse" | "house" | "land" | null
**deal_type**: "sale" | "rent" | "both" (по умолчанию "rent")
**region**: "bangtao" | "kamala" | "surin" | "layan" | "rawai" | "patong" | "kata" | "karon" | "naiharn" | "maikhao" | "chalong" | "phukettown" | "naiyang" | "cherngtalay" | null

❌ НИКОГДА НЕ ВОЗВРАЩАЙ ПУСТЫЕ СТРОКИ "" ДЛЯ ЭТИХ ПОЛЕЙ!
✅ ИСПОЛЬЗУЙ ТОЛЬКО ВАЛИДНЫЕ ЗНАЧЕНИЯ ИЛИ null!

Возвращай ТОЛЬКО валидный JSON без дополнительного текста!`;
}

  /**
   * Конвертация в THB
   */
  private convertToTHB(amount: number, currency: string): number {
    switch (currency.toUpperCase()) {
      case 'RUB':
        return Math.round(amount * 0.38);
      case 'USD':
        return Math.round(amount * 35);
      case 'EUR':
        return Math.round(amount * 38);
      case 'THB':
        return amount;
      default:
        return amount;
    }
  }

  /**
   * Обработка ошибок
   */
  private handleAIError(error: any): Error {
    if (error.response?.status === 401) {
      return new Error('Ошибка аутентификации прокси сервера.');
    }
    
    if (error.response?.status === 503) {
      return new Error('AI сервис временно недоступен.');
    }

    if (error.code === 'ECONNREFUSED') {
      return new Error('Не удалось подключиться к прокси серверу.');
    }
    
    return new Error('Не удалось обработать текст через AI. Попробуйте заполнить форму вручную.');
  }
}

export default new AIPropertyCreationService();