// backend/src/services/aiDescription.service.ts
import axios from 'axios';
import { config } from '../config/config';
import logger from '../utils/logger';
import db from '../config/database';
import imageCollageService from './imageCollage.service';
import fs from 'fs/promises';
import path from 'path';
import locationFeaturesService from './locationFeatures.service';

interface GenerationResult {
  success: boolean;
  descriptions: {
    ru: { description: string };
    en: { description: string };
    th: { description: string };
    zh: { description: string };
    he: { description: string };
  };
  featuresFound: string[];
  message?: string;
}

class AIDescriptionService {
  private readonly proxyUrl: string;
  private readonly proxySecret: string;
  private readonly model: string = 'gpt-4o';

  constructor() {
    this.proxyUrl = config.ai.proxyUrl || '';
    this.proxySecret = config.ai.proxySecret || '';
  }

  async checkReadiness(propertyId: number): Promise<{
    ready: boolean;
    checks: {
      features: { ready: boolean; count: number };
      photos: { ready: boolean; count: number };
      location: { ready: boolean };
      bedrooms: { ready: boolean };
    };
  }> {
    const result: any = await db.query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM property_features WHERE property_id = p.id) as features_count,
        (SELECT COUNT(*) FROM property_photos WHERE property_id = p.id) as photos_count
       FROM properties p 
       WHERE p.id = ?`,
      [propertyId]
    );

    const rows = Array.isArray(result[0]) ? result[0] : result;

    if (!rows || rows.length === 0) {
      throw new Error('Property not found');
    }

    const property = rows[0];

    const checks = {
      features: {
        ready: property.features_count >= 10,
        count: property.features_count
      },
      photos: {
        ready: property.photos_count >= 8,
        count: property.photos_count
      },
      location: {
        ready: !!(property.address && property.region)
      },
      bedrooms: {
        ready: property.bedrooms !== null && property.bedrooms !== undefined
      }
    };

    const ready = checks.features.ready && 
                  checks.photos.ready && 
                  checks.location.ready && 
                  checks.bedrooms.ready;

    return { ready, checks };
  }

  async checkRateLimit(propertyId: number): Promise<{ allowed: boolean; remainingSeconds: number }> {
    const result: any = await db.query(
      'SELECT last_generation_at FROM ai_generation_rate_limit WHERE property_id = ?',
      [propertyId]
    );

    const rows = Array.isArray(result[0]) ? result[0] : result;

    if (!rows || rows.length === 0) {
      return { allowed: true, remainingSeconds: 0 };
    }

    const lastGeneration = new Date(rows[0].last_generation_at);
    const now = new Date();
    const diffMs = now.getTime() - lastGeneration.getTime();
    const diffMinutes = diffMs / 1000 / 60;

    const rateLimitMinutes = 3;
    const allowed = diffMinutes >= rateLimitMinutes;
    const remainingSeconds = allowed ? 0 : Math.ceil((rateLimitMinutes - diffMinutes) * 60);

    return { allowed, remainingSeconds };
  }

  private async updateRateLimit(propertyId: number): Promise<void> {
    await db.query(
      `INSERT INTO ai_generation_rate_limit (property_id, last_generation_at) 
       VALUES (?, NOW()) 
       ON DUPLICATE KEY UPDATE last_generation_at = NOW()`,
      [propertyId]
    );
  }

async generateDescriptions(
  propertyId: number, 
  userId: number,
  additionalPrompt?: string
): Promise<GenerationResult> {
  logger.info(`Starting AI description generation for property ${propertyId}`);

  try {
    const readiness = await this.checkReadiness(propertyId);
    if (!readiness.ready) {
      throw new Error('Property is not ready for generation');
    }

    const rateLimit = await this.checkRateLimit(propertyId);
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rateLimit.remainingSeconds / 60)} more minutes`);
    }

    const property = await this.getPropertyData(propertyId);
    const photos = await this.getPropertyPhotos(propertyId);
    
    if (photos.length < 6) {
      throw new Error('Minimum 6 photos required for generation');
    }

    await imageCollageService.cleanupOldCollages(propertyId);
    const collages = await imageCollageService.createCollages(photos, propertyId);

    if (collages.length === 0) {
      throw new Error('Failed to create photo collages');
    }

    // ✅ Анализируем фотографии
    const featuresFromPhotos = await this.analyzePhotos(collages);
    
    // ✅ Добавляем автоматические особенности на основе типа сделки
    const autoFeatures = this.getAutomaticFeatures(property);
    
    // ✅ НОВОЕ: Получаем локационные особенности через Google Places API
    let locationFeatures: string[] = [];
    if (property.latitude && property.longitude) {
      try {
        locationFeatures = await locationFeaturesService.getLocationFeatures(
          parseFloat(property.latitude),
          parseFloat(property.longitude),
          property.region,
          property.distance_to_beach
        );
        logger.info(`Found ${locationFeatures.length} location features via Google Places API`);
      } catch (error) {
        logger.warn('Failed to get location features:', error);
        // Fallback к старому методу
        locationFeatures = this.getLocationFeatures(property);
      }
    } else {
      // Если нет координат - используем только район
      locationFeatures = this.getLocationFeatures(property);
    }
    
    // ✅ Объединяем все особенности
    const allFeaturesFound = [...new Set([
      ...featuresFromPhotos,
      ...autoFeatures,
      ...locationFeatures
    ])];

    logger.info(`Total features found: ${allFeaturesFound.length}`);

    const descriptions = await this.generateMultilingualDescriptions(
      property, 
      allFeaturesFound,
      additionalPrompt
    );

    await this.saveGenerationLog(propertyId, userId, allFeaturesFound, photos.length, collages.length, additionalPrompt);
    await this.updateRateLimit(propertyId);

    logger.info(`Successfully generated descriptions for property ${propertyId}`);

    return {
      success: true,
      descriptions,
      featuresFound: allFeaturesFound
    };

  } catch (error: any) {
    logger.error(`Failed to generate descriptions for property ${propertyId}:`, error);
    throw error;
  }
}

  /**
   * ✅ НОВОЕ: Получает автоматические особенности на основе типа сделки
   */
  private getAutomaticFeatures(property: any): string[] {
    const features: string[] = [];
    
    // Базовые особенности для ВСЕХ объектов
    features.push('wifi', 'parking', 'securitySystem');
    
    // Особенности для аренды
    if (property.deal_type === 'rent' || property.deal_type === 'both') {
      features.push(
        'onlinePayment',
        'cashPayment',
        'lateCheckout',
        'earlyCheckin',
        'earlyBooking',
        'longTermRental'
      );
    }
    
    // Ванная комната (очевидно для любого жилья)
    features.push('bathroom');
    
    // Кухня (если есть спальни, значит есть кухня)
    if (property.bedrooms && property.bedrooms > 0) {
      features.push('kitchen');
    }
    
    return features;
  }

  /**
   * ✅ НОВОЕ: Определяет особенности локации на основе района и координат
   */
  private getLocationFeatures(property: any): string[] {
    const features: string[] = [];
    
    const regionFeatures: Record<string, string[]> = {
      'patong': ['nightlife', 'nearRestaurants', 'nearBars', 'nearShops', 'nearPharmacy', 'nearHospital'],
      'bangtao': ['nearGolf', 'nearRestaurants', 'nearShops', 'nearPharmacy', 'peaceful'],
      'kamala': ['peaceful', 'nearRestaurants', 'nearShops'],
      'surin': ['nearRestaurants', 'nearBars', 'nearShops', 'peaceful'],
      'layan': ['peaceful', 'nearGolf', 'exclusive'],
      'rawai': ['peaceful', 'nearRestaurants', 'nearMarket'],
      'kata': ['nearRestaurants', 'nearShops', 'nearPharmacy'],
      'maikhao': ['peaceful', 'nearAirport']
    };
    
    if (property.region && regionFeatures[property.region]) {
      features.push(...regionFeatures[property.region]);
    }
    
    // Близость к пляжу
    if (property.distance_to_beach) {
      if (property.distance_to_beach < 500) {
        features.push('nearBeach');
      }
    }
    
    return features;
  }

  private async getPropertyData(propertyId: number): Promise<any> {
    const result: any = await db.query(
      `SELECT p.*, 
        GROUP_CONCAT(DISTINCT pf.feature_type, ':', pf.feature_value) as features_raw
       FROM properties p
       LEFT JOIN property_features pf ON p.id = pf.property_id
       WHERE p.id = ?
       GROUP BY p.id`,
      [propertyId]
    );

    const rows = Array.isArray(result[0]) ? result[0] : result;

    if (!rows || rows.length === 0) {
      throw new Error('Property not found');
    }

    const property = rows[0];

    const features: any = {
      property: [],
      outdoor: [],
      rental: [],
      location: [],
      views: []
    };

    if (property.features_raw) {
      const featuresPairs = property.features_raw.split(',');
      featuresPairs.forEach((pair: string) => {
        const [type, value] = pair.split(':');
        if (features[type]) {
          features[type].push(value);
        }
      });
    }

    property.features = features;
    delete property.features_raw;

    return property;
  }

  private async getPropertyPhotos(propertyId: number): Promise<Array<{url: string, category?: string}>> {
    const result: any = await db.query(
      'SELECT photo_url, category FROM property_photos WHERE property_id = ? ORDER BY sort_order ASC, is_primary DESC',
      [propertyId]
    );

    const rows = Array.isArray(result[0]) ? result[0] : result;

    return rows.map((row: any) => ({
      url: row.photo_url,
      category: row.category
    }));
  }

  /**
   * ✅ УЛУЧШЕННЫЙ: Анализ фотографий с детальными инструкциями
   */
  private async analyzePhotos(collages: string[]): Promise<string[]> {
    logger.info(`Analyzing ${collages.length} collages for features detection`);

    const base64Images = await Promise.all(
      collages.map(async (collagePath) => {
        const fullPath = path.join(config.uploadsDir, collagePath);
        const imageBuffer = await fs.readFile(fullPath);
        return imageBuffer.toString('base64');
      })
    );

    const analysisPrompt = this.buildFeaturesAnalysisPrompt();

    const messages = [
      {
        role: 'system',
        content: analysisPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Проанализируй фотографии этого объекта недвижимости МАКСИМАЛЬНО ВНИМАТЕЛЬНО. Найди ВСЕ возможные особенности из списка. Верни JSON со списком найденных особенностей. Возвращай ТОЛЬКО валидный JSON без дополнительного текста.'
          },
          ...base64Images.map(base64 => ({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: 'high'
            }
          }))
        ]
      }
    ];

    try {
      const response = await axios.post(
        `${this.proxyUrl}/api/openai/chat/completions`,
        {
          model: this.model,
          messages,
          max_tokens: 3000,
          temperature: 0.2,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.proxySecret}`,
            'Content-Type': 'application/json'
          },
          timeout: 90000
        }
      );

      const responseText = response.data.choices[0]?.message?.content || '{}';
      const result = JSON.parse(responseText);

      logger.info(`Found ${result.features?.length || 0} features from photos`);
      
      return result.features || [];

    } catch (error: any) {
      logger.error('Failed to analyze photos:', error);
      return [];
    }
  }

  /**
   * ✅ УЛУЧШЕННЫЙ: Генерация описаний с переносами строк
   */
  private async generateMultilingualDescriptions(
    property: any, 
    featuresFound: string[],
    additionalPrompt?: string
  ): Promise<any> {
    logger.info('Generating multilingual descriptions');

    const prompt = this.buildDescriptionPrompt(property, featuresFound, additionalPrompt);

    const messages = [
      {
        role: 'system',
        content: prompt
      },
      {
        role: 'user',
        content: 'Сгенерируй СТРУКТУРИРОВАННОЕ описание объекта на 5 языках (русский, английский, тайский, китайский, иврит) с ПЕРЕНОСАМИ СТРОК между абзацами. Верни ТОЛЬКО валидный JSON без дополнительного текста.'
      }
    ];

    try {
      const response = await axios.post(
        `${this.proxyUrl}/api/openai/chat/completions`,
        {
          model: this.model,
          messages,
          max_tokens: 8000,
          temperature: 0.7,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.proxySecret}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      );

      const responseText = response.data.choices[0]?.message?.content || '{}';
      const result = JSON.parse(responseText);

      logger.info('Successfully generated multilingual descriptions');
      
      return result;

    } catch (error: any) {
      logger.error('Failed to generate descriptions:', error);
      throw new Error('Failed to generate descriptions via AI');
    }
  }

/**
 * ✅ МАКСИМАЛЬНО ДЕТАЛЬНЫЙ ПРОМПТ со ВСЕМИ особенностями
 */
private buildFeaturesAnalysisPrompt(): string {
  return `Ты - эксперт-аналитик недвижимости премиум-класса на Пхукете, Таиланд. Твоя задача - найти МАКСИМУМ особенностей из фотографий.

# ПОЛНЫЙ СПИСОК ВСЕХ ОСОБЕННОСТЕЙ

## 🏠 ОСОБЕННОСТИ ОБЪЕКТА (Property Features)

### Основные помещения и планировка
- **studio**: Студия (единое пространство)
- **openPlan**: Открытая планировка (кухня-гостиная объединены)
- **duplex**: Дуплекс (двухуровневая квартира)
- **triplex**: Триплекс (трехуровневая)
- **multiLevel**: Многоуровневая
- **groundFloor**: Первый этаж
- **topFloor**: Последний этаж
- **penthouseLevel**: Пентхаус уровень
- **cornerUnit**: Угловая квартира

### Входы и доступ
- **separateEntrance**: Отдельный вход
- **privateEntrance**: Частный вход
- **elevator**: Лифт
- **homeElevator**: Домашний лифт
- **privateLift**: Частный лифт
- **ramp**: Пандус
- **emergencyExit**: Аварийный выход

### Кондиционирование и отопление
- **airConditioning**: Кондиционер (блоки на стене/потолке)
- **centralAC**: Центральный кондиционер
- **heating**: Отопление
- **centralHeating**: Центральное отопление
- **floorHeating**: Теплый пол
- **fireplace**: Камин (дровяной, газовый, электрический)

### Архитектурные особенности
- **highCeiling**: Высокие потолки (>3м)
- **largeWindows**: Большие окна
- **floorToFloorWindows**: Окна от пола до потолка
- **skylightView**: Мансардные окна
- **balcony**: Балкон
- **terrace**: Терраса, патио

### Хранение и гардероб
- **walkinCloset** / **walkInCloset**: Гардеробная комната
- **builtinWardrobe**: Встроенный шкаф
- **storageRoom**: Кладовая
- **utilityRoom**: Подсобное помещение
- **pantry**: Кладовая для продуктов

### Кухни
- **westernKitchen**: Западная кухня
- **thaiKitchen**: Тайская кухня
- **openKitchen**: Открытая кухня
- **closedKitchen**: Закрытая кухня
- **outdoorKitchen**: Уличная кухня
- **summerKitchen**: Летняя кухня

### Санузлы
- **bathroom**: Ванная комната (ВСЕГДА есть)
- **bathtub**: Ванна
- **shower**: Душ
- **separateShower**: Отдельный душ
- **ensuiteБathroom**: Ванная при спальне
- **sharedBathroom**: Общая ванная
- **outdoorBathroom**: Уличная ванная
- **wetRoom**: Влажная комната
- **powderRoom**: Туалетная комната

### Специальные комнаты
- **mediaRoom**: Медиа-комната
- **homeTheater**: Домашний кинотеатр
- **study**: Кабинет
- **library**: Библиотека
- **winecellar**: Винный погреб
- **gameRoom**: Игровая комната
- **billiardRoom**: Бильярдная
- **kidsRoom**: Детская комната
- **nursery**: Комната для младенца
- **guestRoom**: Гостевая комната
- **maidsQuarters**: Комната для персонала
- **maidRoom**: Комната прислуги
- **serviceRoom**: Служебная комната

### Спорт и велнес
- **privateGym**: Частный спортзал
- **gym**: Тренажерный зал
- **yogaRoom**: Комната для йоги
- **meditationRoom**: Комната для медитации
- **massage**: Массажная комната
- **privateSauna**: Частная сауна
- **sauna**: Сауна
- **steamRoom**: Паровая комната
- **hammam**: Хаммам

### Искусство и хобби
- **artStudio**: Художественная студия
- **workshop**: Мастерская
- **musicSystem**: Музыкальная система
- **piano**: Фортепиано

### Дизайн и отделка
- **modernDesign**: Современный дизайн (минимализм, модерн)
- **traditionalStyle**: Традиционный стиль
- **minimalist**: Минимализм
- **luxury**: Класс люкс
- **euroRenovation**: Евроремонт
- **designerRenovation**: Дизайнерский ремонт (видны дизайнерские решения)
- **furnished**: Меблирована
- **partiallyFurnished**: Частично меблирована
- **fullyEquipped**: Полностью оборудована

### Безопасность
- **securitySystem**: Система безопасности (ВСЕГДА)
- **cctv**: Видеонаблюдение (камеры)
- **alarmSystem**: Сигнализация
- **intercom**: Домофон
- **videoIntercom**: Видеодомофон
- **safebox**: Сейф
- **smokeDetector**: Датчик дыма
- **carbonMonoxide**: Датчик угарного газа
- **fireExtinguisher**: Огнетушитель
- **firstAidKit**: Аптечка

### Умные технологии
- **smartHome**: Умный дом (панели управления, автоматизация)
- **soundproofing**: Звукоизоляция
- **soundproofWindows**: Звуконепроницаемые окна

### Бытовая техника - Кухня
- **refrigerator**: Холодильник
- **microwave**: Микроволновая печь
- **oven**: Духовка
- **stove**: Плита
- **gasStove**: Газовая плита
- **electricStove**: Электрическая плита
- **inductionStove**: Индукционная плита
- **dishwasher**: Посудомоечная машина
- **coffeemaker**: Кофеварка
- **kettle**: Чайник
- **toaster**: Тостер
- **waterDispenser**: Кулер

### Бытовая техника - Прачечная
- **washer** / **washingMachine**: Стиральная машина
- **dryer**: Сушильная машина
- **iron**: Утюг
- **laundryRoom**: Прачечная
- **dryingArea**: Зона для сушки

### Мебель
- **diningTable**: Обеденный стол
- **outdoorFurniture**: Уличная мебель
- **sunbeds**: Шезлонги
- **hangers**: Вешалки

### Технологии и развлечения
- **tv**: Телевизор
- **smartTV**: Смарт ТВ
- **wifi**: WiFi (ВСЕГДА)
- **highSpeedInternet**: Высокоскоростной интернет
- **fiberOptic**: Оптоволокно
- **telephone**: Телефон
- **satelliteTV** / **cableTV**: Спутниковое/кабельное ТВ
- **surround**: Объемный звук

### Инженерия и коммуникации
- **solarPanels**: Солнечные панели
- **waterHeater**: Водонагреватель
- **solarWaterHeater**: Солнечный водонагреватель
- **waterFiltration**: Фильтрация воды
- **airPurifier**: Очиститель воздуха
- **generator**: Генератор
- **ups**: ИБП
- **waterTank**: Резервуар для воды
- **waterPump**: Водяной насос

### Экология
- **eco**: Экологичная
- **energyEfficient**: Энергоэффективная
- **sustainable**: Устойчивое развитие
- **greenBuilding**: Зеленое здание
- **leed**: Сертификат LEED

### Доступность
- **wheelchair**: Для инвалидных колясок
- **disabledAccess**: Доступ для людей с ограниченными возможностями

### Политика
- **petFriendly** / **petsAllowed**: Можно с животными
- **childFriendly** / **kidfriendly**: Подходит для детей
- **infantFriendly**: Для младенцев
- **teenagerFriendly**: Для подростков
- **familyFriendly**: Для семей
- **adultsOnly**: Только для взрослых

### Статус
- **newConstruction**: Новостройка
- **underConstruction**: В строительстве
- **readyToMove**: Готова к заселению
- **offPlan**: По плану
- **resale**: Перепродажа

## 🌳 ВНЕШНИЕ ОСОБЕННОСТИ (Outdoor Features)

### Бассейны
- **privatePool**: БОЛЬШОЙ частный бассейн (>15м²)
- **sharedPool**: Общий бассейн комплекса
- **infinityPool**: Бассейн инфинити
- **kidPool**: Детский бассейн
- **poolBar**: Бар у бассейна
- **jacuzzi**: МАЛЕНЬКАЯ ванна с гидромассажем (2-4 места)

### Сады и ландшафт
- **garden**: Сад
- **privateGarden**: Частный сад
- **landscaped**: Ландшафтный дизайн
- **tropicalGarden**: Тропический сад
- **japaneseGarden**: Японский сад
- **vegetableGarden**: Огород
- **fruitTrees**: Фруктовые деревья
- **flowerGarden**: Цветник

### Террасы и крыши
- **terrace**: Терраса, патио
- **rooftop**: Крыша
- **rooftopTerrace**: Терраса на крыше
- **skyGarden**: Сад на крыше
- **lounge**: Лаунж зона

### Зоны отдыха
- **bbqArea**: Зона барбекю
- **outdoorDining**: Обеденная зона на улице
- **sunshade**: Навес от солнца
- **pergola**: Пергола
- **gazebo**: Беседка
- **pavilion**: Павильон

### Водные элементы
- **fountain**: Фонтан
- **pond**: Пруд
- **koiPond**: Пруд с карпами кои
- **waterfall**: Водопад
- **streambed**: Ручей

### Душевые
- **outdoorShower**: Уличный душ
- **beachShower**: Душ для пляжа
- **petShower**: Душ для животных

### Парковка
- **garage**: Гараж
- **carport**: Навес для машины
- **coveredParking**: Крытая парковка
- **openParking**: Открытая парковка
- **secureParking**: Охраняемая парковка
- **guestParking**: Парковка для гостей
- **parking**: Парковка (ВСЕГДА)
- **electricCarCharger**: Зарядка для электромобиля
- **bikestorage**: Место для велосипедов

### Детские зоны
- **playground**: Детская площадка
- **swingSet**: Качели
- **slide**: Горка
- **sandbox**: Песочница
- **trampoline**: Батут

### Зоны для животных
- **petArea**: Зона для животных
- **dogRun**: Выгул для собак

### Хозяйственные
- **storageRoom**: Кладовая
- **shed**: Сарай
- **greenhouse**: Теплица
- **workshop**: Мастерская

### Спортивные площадки
- **outdoorGym**: Уличный спортзал
- **sportsArea**: Спортивная площадка
- **tennisCourt**: Теннисный корт
- **basketballCourt**: Баскетбольная площадка
- **footballField**: Футбольное поле
- **volleyball**: Волейбольная площадка
- **badminton**: Площадка для бадминтона
- **puttingGreen**: Поле для гольфа
- **bocce**: Площадка для боче
- **skatepark**: Скейтпарк
- **joggingTrack**: Беговая дорожка
- **walkingPath**: Пешеходная дорожка
- **cyclingPath**: Велосипедная дорожка

### Водный доступ
- **fishingPier**: Причал для рыбалки
- **boatDock**: Лодочный причал
- **marina**: Марина
- **beachAccess**: Доступ к пляжу
- **privateBeach**: Частный пляж
- **beachCabana**: Пляжная кабинка

### Ограждение и въезд
- **fence**: Забор
- **wall**: Стена
- **gate**: Ворота
- **electricGate**: Электрические ворота
- **securityGate**: Охранные ворота
- **driveway**: Подъездная дорога
- **pavedDriveway**: Асфальтированная дорога
- **gravelDriveway**: Гравийная дорога

### Освещение
- **streetLighting**: Уличное освещение
- **gardenLighting**: Садовое освещение
- **securityLighting**: Охранное освещение
- **decorativeLighting**: Декоративное освещение

### Полив и водоснабжение
- **sprinklerSystem**: Система полива
- **automaticSprinklers**: Автоматический полив
- **drip**: Капельный полив
- **irrigationSystem**: Система орошения
- **rainwaterCollection**: Сбор дождевой воды
- **well**: Колодец
- **borehole**: Скважина

### Канализация
- **septicTank**: Септик
- **sewageSystem**: Канализация
- **drainageSystem**: Дренажная система

## 💰 ОСОБЕННОСТИ АРЕНДЫ (Rental Features)

### Интернет и ТВ
- **wifi**: WiFi (АВТОМАТИЧЕСКИ)
- **cableTV**: Кабельное ТВ
- **netflix**: Netflix, стриминги

### Удобства
- **hairDryer**: Фен
- **safe**: Сейф
- **kitchen**: Кухня
- **bathroomAmenities**: Туалетные принадлежности
- **linens**: Постельное белье
- **towels**: Полотенца

### Услуги
- **maidService**: Услуги горничной
- **dailyCleaning**: Ежедневная уборка
- **weeklyCleaning**: Еженедельная уборка
- **chefService**: Услуги повара
- **privateChef**: Частный повар
- **airportTransfer**: Трансфер из аэропорта
- **carRental**: Аренда автомобиля
- **driverService**: Услуги водителя

### Питание
- **breakfastIncluded**: Завтрак включен
- **halfBoard**: Полупансион
- **fullBoard**: Полный пансион
- **allInclusive**: Все включено

### Коммунальные
- **utilitiesIncluded**: Коммунальные включены
- **electricityIncluded**: Электричество включено
- **waterIncluded**: Вода включена
- **wifiIncluded**: WiFi включен

### Услуги комплекса
- **conciergeService**: Консьерж
- **24hConcierge**: Консьерж 24/7
- **securityGuard**: Охрана
- **24hSecurity**: Охрана 24/7
- **maintenance**: Обслуживание
- **gardenMaintenance**: Уход за садом
- **poolMaintenance**: Уход за бассейном

### Условия оплаты (АВТОМАТИЧЕСКИ для аренды)
- **onlinePayment**: Онлайн оплата
- **cashPayment**: Оплата наличными
- **lateCheckout**: Поздний выезд
- **earlyCheckin**: Ранний заезд
- **earlyBooking**: Раннее бронирование
- **longTermRental**: Долгосрочная аренда
- **shortTermRental**: Краткосрочная аренда
- **flexibleCheckIn**: Гибкий заезд

## 📍 ЛОКАЦИОННЫЕ ОСОБЕННОСТИ (Location Features)

### Пляж
- **beachAccess**: Доступ к пляжу
- **beachFront**: Первая линия
- **nearBeach**: Близко к пляжу (<500м)
- **walkToBeach**: Пешком до пляжа

### Образование
- **nearSchool**: Рядом школа
- **nearInternationalSchool**: Рядом международная школа
- **nearKindergarten**: Рядом детский сад
- **nearUniversity**: Рядом университет

### Медицина
- **nearHospital**: Рядом больница
- **nearClinic**: Рядом клиника
- **nearPharmacy**: Рядом аптека

### Покупки
- **nearSupermarket**: Рядом супермаркет
- **nearConvenience**: Рядом магазин
- **nearMarket**: Рядом рынок
- **nearMall**: Рядом ТЦ
- **nearShops**: Рядом магазины

### Питание и развлечения
- **nearRestaurants** / **nearRestaurant**: Рядом рестораны
- **nearCafe**: Рядом кафе
- **nearBars** / **nearBar**: Рядом бары
- **nightlife**: Ночная жизнь рядом

### Спорт и отдых
- **nearGolf** / **nearGolfCourse**: Рядом гольф-поле
- **nearMarina**: Рядом марина
- **nearYachtClub**: Рядом яхт-клуб
- **nearGym**: Рядом спортзал
- **nearFitness**: Рядом фитнес
- **nearYoga**: Рядом йога-студия
- **nearSpa**: Рядом спа
- **nearTennisCourt**: Рядом теннисный корт

### Транспорт
- **nearAirport**: Рядом аэропорт
- **nearBusStop**: Рядом автобусная остановка
- **nearTaxiStand**: Рядом стоянка такси

### Услуги
- **nearBank**: Рядом банк
- **nearAtm**: Рядом банкомат
- **nearPostOffice**: Рядом почта

### Природа
- **nearPark**: Рядом парк
- **nearGarden**: Рядом сад
- **nearForest**: Рядом лес
- **nearMountain**: Рядом горы
- **peaceful**: Тихий район
- **quietArea**: Тихий район

### Тип района
- **gatedCommunity**: Закрытый комплекс
- **secureComplex**: Охраняемый комплекс
- **luxuryDevelopment**: Элитная застройка
- **exclusive**: Эксклюзивный

## 🌅 ВИДЫ (Views) - КРИТИЧЕСКИ ВАЖНО!

### Водные виды
- **seaView**: ВИД НА МОРЕ (видна вода океана, линия горизонта)
- **oceanView**: ВИД НА ОКЕАН (то же что seaView)
- **beachView**: ВИД НА ПЛЯЖ (виден песок пляжа)
- **bayView**: ВИД НА ЗАЛИВ
- **coastalView**: ВИД НА ПОБЕРЕЖЬЕ
- **riverView**: ВИД НА РЕКУ
- **lakeView**: ВИД НА ОЗЕРО
- **pondView**: ВИД НА ПРУД
- **waterfallView**: ВИД НА ВОДОПАД
- **partialSeaView**: Частичный вид на море
- **glimpseOfSea**: Проблески моря
- **distantSeaView**: Отдаленный вид на море

### Природные виды
- **mountainView**: ВИД НА ГОРЫ (видны холмы, горы)
- **hillView**: ВИД НА ХОЛМЫ
- **volcanoView**: ВИД НА ВУЛКАН
- **gardenView**: ВИД НА САД (зелень, растения)
- **parkView**: ВИД НА ПАРК
- **forestView**: ВИД НА ЛЕС

### Виды на объект
- **poolView**: ВИД НА БАССЕЙН (из окна виден бассейн)
- **cityView**: ВИД НА ГОРОД
- **skylineView**: ВИД НА ГОРИЗОНТ

### Временные виды
- **sunsetView**: ВИД НА ЗАКАТ (окна на запад)
- **sunriseView**: ВИД НА РАССВЕТ (окна на восток)

### Панорамные виды
- **panoramicView**: ПАНОРАМНЫЙ ВИД (широкий обзор 180°+)
- **unobstructedView**: Незагороженный вид
- **180View**: Вид 180 градусов
- **360View**: Вид 360 градусов
- **scenicView**: Живописный вид
- **spectacularView**: Захватывающий вид
- **breathtakingView**: Захватывающий дух вид
- **stunningView**: Потрясающий вид

### Стороны света
- **facingNorth**: Вид на север
- **facingSouth**: Вид на юг
- **facingEast**: Вид на восток
- **facingWest**: Вид на запад

# ИНСТРУКЦИИ ПО АНАЛИЗУ

## КРИТИЧЕСКИЕ ПРАВИЛА определения ВИДОВ:

1. **seaView / oceanView**: Если на фото С ТЕРРАСЫ или ИЗ ОКНА видна ВОДА моря/океана → seaView
2. **mountainView**: Если видны ХОЛМЫ, ГОРЫ, возвышенности → mountainView
3. **gardenView**: Если видны ДЕРЕВЬЯ, РАСТЕНИЯ, зелень → gardenView
4. **poolView**: Если из окна/террасы ВИДЕН БАССЕЙН → poolView
5. **panoramicView**: Если БОЛЬШИЕ панорамные окна, вид на 180°+ → panoramicView
6. **sunsetView**: Если есть фото заката ИЛИ терраса на ЗАПАД → sunsetView

## Бассейн vs Джакузи:

- **privatePool/sharedPool**: БОЛЬШОЙ водоем (>15м²), прямоугольный, для плавания
- **jacuzzi**: МАЛЕНЬКАЯ ванна (2-4 места), круглая, с форсунками

## Дизайнерский ремонт:

- **designerRenovation**: Если видны уникальные дизайнерские решения, необычные материалы, авторская мебель, стильные акценты

## Автоматические особенности (ВСЕГДА добавляй):

✅ **wifi** - ВСЕГДА
✅ **parking** - ВСЕГДА  
✅ **securitySystem** - ВСЕГДА
✅ **bathroom** - ВСЕГДА
✅ **kitchen** - если видна кухонная мебель

## ДЛЯ АРЕНДЫ (автоматически):
✅ **onlinePayment**
✅ **cashPayment**
✅ **lateCheckout**
✅ **earlyCheckin**
✅ **earlyBooking**
✅ **longTermRental**

## Что ОБЯЗАТЕЛЬНО искать:

1. **Кондиционеры** на стенах/потолке → airConditioning
2. **ВСЕ ВИДЫ** из окон (море, горы, сад, бассейн)
3. **Кухонную технику** (холодильник, плита, микроволновка)
4. **Бассейн** (размер, тип)
5. **Террасы, балконы**
6. **Дизайн** (современный, дизайнерский)
7. **Ванные** (ванна, душ)
8. **Мебель** (обеденный стол, шезлонги)
9. **Сад и ландшафт**
10. **Охрану** (камеры, ворота)

# ФОРМАТ ОТВЕТА

{
  "features": ["wifi", "parking", "securitySystem", "bathroom", "privatePool", "seaView", "mountainView", "kitchen", "refrigerator", "airConditioning", "modernDesign", "terrace", "gardenView", ...],
  "confidence": 0.95,
  "reasoning": "Детальное объяснение КАЖДОЙ найденной особенности"
}

**МИНИМУМ 25-35 особенностей!** Будь МАКСИМАЛЬНО внимательным к деталям!

Возвращай ТОЛЬКО валидный JSON без текста.`;
}

  /**
   * ✅ УЛУЧШЕННЫЙ ПРОМПТ с переносами строк и расстоянием в км
   */
  private buildDescriptionPrompt(property: any, featuresFound: string[], additionalPrompt?: string): string {
    const regionInfo = this.getRegionInfo(property.region);
    const propertyTypeRu = this.getPropertyTypeRu(property.property_type);

    const allFeatures = [
      ...(property.features?.property || []),
      ...(property.features?.outdoor || []),
      ...(property.features?.rental || []),
      ...(property.features?.location || []),
      ...(property.features?.views || []),
      ...featuresFound
    ];

    const uniqueFeatures = [...new Set(allFeatures)];

    const dealType = property.deal_type;
    const isSale = dealType === 'sale' || dealType === 'both';
    const isRent = dealType === 'rent' || dealType === 'both';

    // ✅ Форматируем расстояние до пляжа
    let beachDistanceText = '';
    if (property.distance_to_beach) {
      if (property.distance_to_beach >= 1000) {
        const km = (property.distance_to_beach / 1000).toFixed(1);
        beachDistanceText = `- Расстояние до пляжа: ${km} км`;
      } else {
        beachDistanceText = `- Расстояние до пляжа: ${property.distance_to_beach} метров`;
      }
    }

    let dealTypeInstructions = '';
    if (dealType === 'sale') {
      dealTypeInstructions = `
# ВАЖНО: ТИП СДЕЛКИ - ПРОДАЖА

Этот объект для ПРОДАЖИ. Описание должно:
- Упоминать: "приобретение", "владение", "инвестиция"
- Завершать: "Не упустите возможность стать владельцем..."
- НЕ использовать: "аренда", "снять"`;
    } else if (dealType === 'rent') {
      dealTypeInstructions = `
# ВАЖНО: ТИП СДЕЛКИ - АРЕНДА

Этот объект для АРЕНДЫ. Описание должно:
- Упоминать: "аренда", "проживание", "отдых"
- Завершать: "Забронируйте этот дом для незабываемого отдыха..."
- НЕ использовать: "покупка", "владение", "инвестиция"`;
    } else {
      dealTypeInstructions = `
# ВАЖНО: ТИП СДЕЛКИ - ПРОДАЖА И АРЕНДА

Доступен для ПРОДАЖИ и АРЕНДЫ. Упомяни обе возможности.`;
    }

    return `Ты - элитный копирайтер недвижимости на Пхукете. Создай ДЕТАЛЬНОЕ, СТРУКТУРИРОВАННОЕ описание.

${dealTypeInstructions}

# ДАННЫЕ ОБ ОБЪЕКТЕ

**Тип:** ${propertyTypeRu}
**Район:** ${property.region} - ${regionInfo}
**Номер:** ${property.property_number}
${property.complex_name ? `**Комплекс:** ${property.complex_name}` : ''}

**Характеристики:**
- Спален: ${property.bedrooms || 'не указано'}
- Ванных: ${property.bathrooms || 'не указано'}
- Площадь: ${property.indoor_area ? property.indoor_area + ' м²' : 'не указано'}
${beachDistanceText}

**Особенности (${uniqueFeatures.length}):**
${uniqueFeatures.join(', ')}

**Цена:**
${isSale && property.sale_price ? `Продажа: ${property.sale_price.toLocaleString()} ฿` : ''}
${isRent && property.year_price ? `Аренда: ${property.year_price.toLocaleString()} ฿/год` : ''}

${additionalPrompt || ''}

# ТРЕБОВАНИЯ К СТРУКТУРЕ

## ОБЯЗАТЕЛЬНО используй переносы строк (\n\n) между абзацами!

Структура описания:

**Абзац 1:** Вводная часть (2-3 предложения)
\n\n
**Абзац 2:** Описание интерьера и комнат (3-4 предложения)
\n\n
**Абзац 3:** Внешние пространства (терраса, бассейн, сад) (3-4 предложения)
\n\n
**Абзац 4:** Удобства и особенности (2-3 предложения)
\n\n
**Абзац 5:** Локация и окружение (2-3 предложения)
\n\n
**Абзац 6:** Заключение и призыв к действию (2 предложения)

КРИТИЧЕСКИ ВАЖНО: МЕЖДУ каждым абзацем должен быть двойной перенос строки (\n\n)!

## Стиль:
- Роскошный язык
- Детали из данных
- Эмоциональность
- 600-800 слов

## ОБЯЗАТЕЛЬНО упомянуть:
1. ВСЕ виды (море, горы, сад, бассейн)
2. Бассейн детально (размер, расположение)
3. Расстояние до пляжа (В КМ если >1000м, иначе в метрах)
4. Район и его преимущества
5. Все особенности из списка
6. Кухню и технику
7. Террасы и балконы

# ФОРМАТ ОТВЕТА

{
  "ru": {
    "description": "Абзац 1\n\nАбзац 2\n\nАбзац 3\n\n..."
  },
  "en": {
    "description": "Paragraph 1\n\nParagraph 2\n\n..."
  },
  "th": {
    "description": "ย่อหน้า 1\n\nย่อหน้า 2\n\n..."
  },
  "zh": {
    "description": "段落1\n\n段落2\n\n..."
  },
  "he": {
    "description": "פסקה 1\n\nפסקה 2\n\n..."
  }
}

Возвращай ТОЛЬКО JSON. В description ОБЯЗАТЕЛЬНО используй \n\n между абзацами!`;
  }

  private getRegionInfo(region: string): string {
    const regions: Record<string, string> = {
      'patong': 'Самый живой район, центр ночной жизни, множество ресторанов и развлечений',
      'bangtao': 'Престижный район Laguna с развитой инфраструктурой и гольф-полем',
      'kamala': 'Спокойный семейный район с отличным пляжем',
      'surin': 'Элитный район с шикарным пляжем и ресторанами высокой кухни',
      'layan': 'Эксклюзивный район с частными пляжами и виллами премиум-класса',
      'rawai': 'Тихий южный район, рядом морепродуктовый рынок',
      'kata': 'Семейный район с хорошей инфраструктурой',
      'naiharn': 'Уединенный южный район с красивым пляжем',
      'maikhao': 'Тихий северный район, близко к аэропорту'
    };
    return regions[region] || 'Отличный район на Пхукете';
  }

  private getPropertyTypeRu(type: string): string {
    const types: Record<string, string> = {
      'villa': 'Вилла',
      'apartment': 'Апартаменты',
      'condo': 'Кондоминиум',
      'penthouse': 'Пентхаус',
      'house': 'Дом',
      'land': 'Земельный участок'
    };
    return types[type] || type;
  }

  private async saveGenerationLog(
    propertyId: number,
    userId: number,
    featuresFound: string[],
    photosAnalyzed: number,
    collagesCreated: number,
    additionalPrompt?: string
  ): Promise<void> {
    await db.query(
      `INSERT INTO ai_description_generations 
       (property_id, user_id, features_found, photos_analyzed, collages_created, additional_prompt) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        propertyId,
        userId,
        JSON.stringify(featuresFound),
        photosAnalyzed,
        collagesCreated,
        additionalPrompt || null
      ]
    );
  }
}

export default new AIDescriptionService();