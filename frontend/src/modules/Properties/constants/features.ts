// frontend/src/modules/Properties/constants/features.ts

export const PROPERTY_FEATURES = {
  property: [
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
  ],

  outdoor: [
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
  ],

  rental: [
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
  ],

  location: [
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
  ],

  views: [
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
  ]
};