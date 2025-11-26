// backend/src/services/googleMaps.service.ts
import axios from 'axios';
import logger from '../utils/logger';
import { config } from '../config/config';

interface Coordinates {
  lat: number;
  lng: number;
}

interface BeachLocation {
  name: string;
  coordinates: Coordinates;
}

// Основные пляжи Пхукета
const PHUKET_BEACHES: BeachLocation[] = [
  { name: 'Bang Tao Beach', coordinates: { lat: 8.0228, lng: 98.2967 } },
  { name: 'Surin Beach', coordinates: { lat: 7.9964, lng: 98.2765 } },
  { name: 'Kamala Beach', coordinates: { lat: 7.9626, lng: 98.2795 } },
  { name: 'Patong Beach', coordinates: { lat: 7.8965, lng: 98.2965 } },
  { name: 'Karon Beach', coordinates: { lat: 7.8388, lng: 98.2921 } },
  { name: 'Kata Beach', coordinates: { lat: 7.8145, lng: 98.2920 } },
  { name: 'Kata Noi Beach', coordinates: { lat: 7.8048, lng: 98.2891 } },
  { name: 'Nai Harn Beach', coordinates: { lat: 7.7768, lng: 98.3033 } },
  { name: 'Rawai Beach', coordinates: { lat: 7.7734, lng: 98.3217 } },
  { name: 'Mai Khao Beach', coordinates: { lat: 8.1181, lng: 98.2942 } },
  { name: 'Nai Yang Beach', coordinates: { lat: 8.0842, lng: 98.2967 } },
  { name: 'Layan Beach', coordinates: { lat: 8.0106, lng: 98.2862 } },
  { name: 'Freedom Beach', coordinates: { lat: 7.8714, lng: 98.2767 } },
  { name: 'Paradise Beach', coordinates: { lat: 7.8795, lng: 98.2802 } },
  { name: 'Yamu Beach', coordinates: { lat: 7.9900, lng: 98.4157 } }
];

class GoogleMapsService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.googleMapsApiKey || '';
    
    if (!this.apiKey) {
      logger.warn('Google Maps API key not configured');
    }
  }

  /**
   * Рассчитать расстояние до ближайшего пляжа
   */
  async calculateDistanceToNearestBeach(propertyCoords: Coordinates): Promise<{
    distance: number;
    beachName: string;
    beachCoords: Coordinates;
  }> {
    try {
      let nearestBeach: BeachLocation | null = null;
      let minDistance = Infinity;

      // Находим ближайший пляж по прямой линии
      for (const beach of PHUKET_BEACHES) {
        const distance = this.calculateHaversineDistance(
          propertyCoords,
          beach.coordinates
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestBeach = beach;
        }
      }

      if (!nearestBeach) {
        throw new Error('Could not find nearest beach');
      }

      // Если есть Google Maps API - получаем точное расстояние по дорогам
      let roadDistance = Math.round(minDistance);
      
      if (this.apiKey) {
        try {
          roadDistance = await this.getDistanceViaRoads(
            propertyCoords,
            nearestBeach.coordinates
          );
        } catch (error) {
          logger.warn('Failed to get road distance, using haversine:', error);
        }
      }

      return {
        distance: roadDistance,
        beachName: nearestBeach.name,
        beachCoords: nearestBeach.coordinates
      };
    } catch (error) {
      logger.error('Error calculating distance to beach:', error);
      throw error;
    }
  }

  /**
   * Получить расстояние через Google Maps Distance Matrix API
   */
  private async getDistanceViaRoads(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<number> {
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/distancematrix/json',
        {
          params: {
            origins: `${origin.lat},${origin.lng}`,
            destinations: `${destination.lat},${destination.lng}`,
            mode: 'walking',
            key: this.apiKey
          },
          timeout: 10000
        }
      );

      if (response.data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${response.data.status}`);
      }

      const element = response.data.rows[0]?.elements[0];
      
      if (element?.status !== 'OK') {
        throw new Error('Could not calculate distance');
      }

      // Возвращаем расстояние в метрах
      return element.distance.value;
    } catch (error) {
      logger.error('Google Maps Distance Matrix API error:', error);
      throw error;
    }
  }

  /**
   * Рассчитать расстояние по формуле Haversine (по прямой)
   */
  private calculateHaversineDistance(
    coord1: Coordinates,
    coord2: Coordinates
  ): number {
    const R = 6371e3; // Радиус Земли в метрах
    const φ1 = (coord1.lat * Math.PI) / 180;
    const φ2 = (coord2.lat * Math.PI) / 180;
    const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Расстояние в метрах
  }

  /**
   * Категоризация расстояния
   */
  categorizeDistance(distanceInMeters: number): string {
    if (distanceInMeters <= 200) return 'На пляже';
    if (distanceInMeters <= 500) return 'У пляжа (до 500м)';
    if (distanceInMeters <= 1000) return 'Близко к пляжу (до 1км)';
    if (distanceInMeters <= 2000) return 'В пределах 2км';
    if (distanceInMeters <= 5000) return 'В пределах 5км';
    return 'Далеко от пляжа (>5км)';
  }
}

export default new GoogleMapsService();