// backend/src/services/locationFeatures.service.ts
import axios from 'axios';
import { config } from '../config/config';
import logger from '../utils/logger';

interface PlaceType {
  type: string;
  features: string[];
  radius: number;
}

class LocationFeaturesService {
  private readonly googleMapsApiKey: string;
  // ✅ ИСПРАВЛЕНО: Используем новый Places API (v1)
  private readonly placesApiUrl = 'https://places.googleapis.com/v1/places:searchNearby';

  private readonly placeTypesMap: PlaceType[] = [
    { type: 'restaurant', features: ['nearRestaurants'], radius: 500 },
    { type: 'cafe', features: ['nearCafe'], radius: 500 },
    { type: 'bar', features: ['nearBars'], radius: 500 },
    { type: 'night_club', features: ['nightlife'], radius: 1000 },
    { type: 'hospital', features: ['nearHospital'], radius: 3000 },
    { type: 'doctor', features: ['nearClinic'], radius: 2000 },
    { type: 'pharmacy', features: ['nearPharmacy'], radius: 1000 },
    { type: 'supermarket', features: ['nearSupermarket'], radius: 1000 },
    { type: 'convenience_store', features: ['nearConvenience'], radius: 500 },
    { type: 'shopping_mall', features: ['nearMall'], radius: 2000 },
    { type: 'school', features: ['nearSchool'], radius: 2000 },
    { type: 'gym', features: ['nearGym'], radius: 1000 },
    { type: 'spa', features: ['nearSpa'], radius: 1000 },
    { type: 'bank', features: ['nearBank'], radius: 1000 },
    { type: 'atm', features: ['nearAtm'], radius: 500 },
    { type: 'park', features: ['nearPark'], radius: 1000 },
    { type: 'bus_station', features: ['nearBusStop'], radius: 500 },
    { type: 'taxi_stand', features: ['nearTaxiStand'], radius: 500 },
  ];

  private readonly regionFeatures: Record<string, string[]> = {
    'patong': ['nightlife', 'nearRestaurants', 'nearBars', 'nearShops', 'nearPharmacy', 'nearHospital', 'nearAtm', 'nearBank', 'nearMall', 'touristArea', 'entertainmentDistrict'],
    'bangtao': ['nearGolf', 'nearRestaurants', 'nearShops', 'nearPharmacy', 'peaceful', 'luxuryDevelopment', 'nearMarina', 'nearSpa', 'gatedCommunity'],
    'kamala': ['peaceful', 'nearRestaurants', 'nearShops', 'nearBeach', 'familyFriendly', 'quietArea'],
    'surin': ['nearRestaurants', 'nearBars', 'nearShops', 'peaceful', 'luxuryDevelopment', 'nearBeach', 'exclusive'],
    'layan': ['peaceful', 'nearGolf', 'exclusive', 'luxuryDevelopment', 'nearBeach', 'gatedCommunity'],
    'rawai': ['peaceful', 'nearRestaurants', 'nearMarket', 'nearBeach', 'localArea', 'quietArea'],
    'kata': ['nearRestaurants', 'nearShops', 'nearPharmacy', 'familyFriendly', 'nearBeach'],
    'naiharn': ['peaceful', 'nearBeach', 'quietArea', 'scenicView'],
    'maikhao': ['peaceful', 'nearAirport', 'nearBeach', 'quietArea', 'luxuryDevelopment'],
    'phuket': ['cityCenter', 'nearShops', 'nearRestaurants', 'nearHospital', 'nearSchool', 'nearMall']
  };

  constructor() {
    this.googleMapsApiKey = config.googleMapsApiKey || '';
    
    if (!this.googleMapsApiKey) {
      logger.warn('Google Maps API key not configured - location features will be limited to region data');
    }
  }

  async getLocationFeatures(
    latitude: number,
    longitude: number,
    region: string,
    distanceToBeach?: number
  ): Promise<string[]> {
    logger.info(`Getting location features for coordinates: ${latitude}, ${longitude}, region: ${region}`);

    const features: Set<string> = new Set();

    const regionFeats = this.getRegionFeatures(region);
    regionFeats.forEach(f => features.add(f));
    logger.info(`Added ${regionFeats.length} region features`);

    if (distanceToBeach !== undefined) {
      const beachFeats = this.getBeachFeatures(distanceToBeach);
      beachFeats.forEach(f => features.add(f));
      logger.info(`Added ${beachFeats.length} beach proximity features`);
    }

    if (this.googleMapsApiKey) {
      try {
        const nearbyFeats = await this.getNearbyPlacesFeatures(latitude, longitude);
        nearbyFeats.forEach(f => features.add(f));
        logger.info(`Added ${nearbyFeats.length} features from Google Places API`);
      } catch (error: any) {
        logger.warn('Failed to get nearby places from Google API:', error.message);
      }
    } else {
      logger.info('Skipping Google Places API - no API key configured');
    }

    logger.info(`Total location features found: ${features.size}`);
    return Array.from(features);
  }

  private getRegionFeatures(region: string): string[] {
    const normalizedRegion = region.toLowerCase().trim();
    const features = this.regionFeatures[normalizedRegion] || [];
    
    if (features.length === 0) {
      logger.warn(`No predefined features for region: ${region}`);
    }
    
    return features;
  }

  private getBeachFeatures(distanceToBeach: number): string[] {
    const features: string[] = [];

    if (distanceToBeach < 200) {
      features.push('beachFront', 'beachAccess');
      logger.info(`Beach distance ${distanceToBeach}m - added beachFront features`);
    } else if (distanceToBeach < 500) {
      features.push('nearBeach', 'walkToBeach', 'beachAccess');
      logger.info(`Beach distance ${distanceToBeach}m - added nearBeach features`);
    } else if (distanceToBeach < 1000) {
      features.push('nearBeach', 'walkToBeach');
      logger.info(`Beach distance ${distanceToBeach}m - added walkToBeach features`);
    }

    return features;
  }

  private async getNearbyPlacesFeatures(
    latitude: number,
    longitude: number
  ): Promise<string[]> {
    const features: Set<string> = new Set();
    const foundPlaces: string[] = [];

    for (const placeType of this.placeTypesMap) {
      try {
        const places = await this.findNearbyPlaces(
          latitude,
          longitude,
          placeType.type,
          placeType.radius
        );

        if (places.length > 0) {
          placeType.features.forEach(f => features.add(f));
          foundPlaces.push(`${placeType.type} (${places.length})`);
          logger.info(`✓ Found ${places.length} ${placeType.type} within ${placeType.radius}m`);
        }

        await this.sleep(200);
      } catch (error: any) {
        logger.error(`✗ Failed to check ${placeType.type}: ${error.message}`);
        
        if (error.message && error.message.includes('REQUEST_DENIED')) {
          logger.error('⚠️ Google Places API access denied. Check:');
          logger.error('  1. Places API (New) is enabled');
          logger.error('  2. API key restrictions allow Places API');
          logger.error('  3. Billing is enabled');
          throw error;
        }
      }
    }

    if (foundPlaces.length > 0) {
      logger.info(`✓ Google Places API found: ${foundPlaces.join(', ')}`);
    }
    
    return Array.from(features);
  }

  /**
   * ✅ ОБНОВЛЕНО: Используем новый Places API (v1)
   */
  private async findNearbyPlaces(
    latitude: number,
    longitude: number,
    placeType: string,
    radius: number
  ): Promise<any[]> {
    try {
      // ✅ Новый формат запроса Places API v1
      const response = await axios.post(
        this.placesApiUrl,
        {
          includedTypes: [placeType],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: {
                latitude,
                longitude
              },
              radius
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.googleMapsApiKey,
            'X-Goog-FieldMask': 'places.displayName,places.types'
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.places) {
        logger.info(`Found ${response.data.places.length} ${placeType}(s)`);
        return response.data.places;
      }
      
      return [];
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || error.response.data?.error || 'Unknown error';
        logger.error(`Google Places API error [${status}]: ${message}`);
        
        if (status === 403 || message.includes('REQUEST_DENIED')) {
          throw new Error('REQUEST_DENIED: Check API key permissions');
        }
      } else {
        logger.error(`Google Places API request failed:`, error.message);
      }
      return [];
    }
  }

  async getLocationDetails(
    latitude: number,
    longitude: number,
    region: string,
    distanceToBeach?: number
  ): Promise<{
    region: string;
    regionDescription: string;
    features: string[];
    nearbyPlacesCount: number;
    distanceToBeachCategory: string;
  }> {
    const regionDesc = this.getRegionDescription(region);
    const features = await this.getLocationFeatures(latitude, longitude, region, distanceToBeach);
    
    let nearbyCount = 0;
    if (this.googleMapsApiKey) {
      for (const placeType of this.placeTypesMap.slice(0, 5)) {
        try {
          const places = await this.findNearbyPlaces(latitude, longitude, placeType.type, placeType.radius);
          nearbyCount += places.length;
          await this.sleep(200);
        } catch (error) {
          break;
        }
      }
    }

    const beachCategory = distanceToBeach 
      ? this.getBeachDistanceCategory(distanceToBeach)
      : 'unknown';

    return {
      region,
      regionDescription: regionDesc,
      features,
      nearbyPlacesCount: nearbyCount,
      distanceToBeachCategory: beachCategory
    };
  }

  private getBeachDistanceCategory(distance: number): string {
    if (distance < 200) return 'beachfront';
    if (distance < 500) return 'near_beach';
    if (distance < 1000) return 'walking_distance';
    if (distance < 2000) return 'short_drive';
    return 'far_from_beach';
  }

  private getRegionDescription(region: string): string {
    const descriptions: Record<string, string> = {
      'patong': 'Самый оживленный район Пхукета с богатой ночной жизнью',
      'bangtao': 'Престижный район Laguna с элитными комплексами',
      'kamala': 'Спокойный семейный район с отличным пляжем',
      'surin': 'Элитный район с роскошными виллами',
      'layan': 'Эксклюзивный район с частными пляжами',
      'rawai': 'Тихий южный район',
      'kata': 'Семейный район с хорошей инфраструктурой',
      'naiharn': 'Уединенный южный район',
      'maikhao': 'Тихий северный район',
      'phuket': 'Центр Пхукета'
    };

    return descriptions[region.toLowerCase()] || 'Отличный район на Пхукете';
  }

  /**
   * ✅ ОБНОВЛЕНО: Тест с новым API
   */
  async testApiConnection(): Promise<{
    available: boolean;
    message: string;
  }> {
    if (!this.googleMapsApiKey) {
      return {
        available: false,
        message: 'Google Maps API key not configured'
      };
    }

    try {
      const response = await axios.post(
        this.placesApiUrl,
        {
          includedTypes: ['restaurant'],
          maxResultCount: 1,
          locationRestriction: {
            circle: {
              center: {
                latitude: 7.8804,
                longitude: 98.2926
              },
              radius: 500
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.googleMapsApiKey,
            'X-Goog-FieldMask': 'places.displayName'
          },
          timeout: 5000
        }
      );

      return {
        available: true,
        message: `Google Places API is working! Found ${response.data.places?.length || 0} places`
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      return {
        available: false,
        message: `Google Places API failed: ${errorMsg}`
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new LocationFeaturesService();