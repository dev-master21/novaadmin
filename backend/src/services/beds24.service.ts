// backend/src/services/beds24.service.ts
import axios, { AxiosError } from 'axios';
import logger from '../utils/logger';

interface Beds24RoomType {
  name: string;
  qty: string;
  roomId: string;
  minPrice?: string;
  maxPeople?: string;
  maxAdult?: string;
  maxChildren?: string;
  unitAllocationPerGuest?: string;
  unitNames?: string;
}

interface Beds24Property {
  name: string;
  propId: string;
  propTypeId?: string;
  ownerId?: string;
  currency?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  latitude?: string;
  longitude?: string;
  roomTypes: Beds24RoomType[];
}

interface Beds24ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

class Beds24Service {
  private readonly BASE_URL = 'https://api.beds24.com/json';
  private readonly TIMEOUT = 15000;

  /**
   * Проверка валидности API ключа V1
   */
  async verifyApiKey(apiKey: string): Promise<Beds24ApiResponse> {
    try {
      logger.info('Verifying Beds24 API key...');

      const response = await axios.post(
        `${this.BASE_URL}/getProperties`,
        {
          authentication: {
            apiKey: apiKey
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: this.TIMEOUT
        }
      );

      logger.info('Beds24 API response status:', response.status);

      // ✅ Данные в response.data.getProperties
      const properties = response.data?.getProperties || [];

      if (response.data?.error) {
        logger.warn('Beds24 API returned error:', response.data.error);
        return {
          success: false,
          message: response.data.error
        };
      }

      if (Array.isArray(properties)) {
        logger.info(`Beds24 API key is valid. Found ${properties.length} properties`);
        return {
          success: true,
          message: properties.length > 0 
            ? `API ключ действителен. Найдено объектов: ${properties.length}`
            : 'API ключ действителен. У вас пока нет объектов в Beds24.'
        };
      }

      logger.warn('Unexpected response format from Beds24');
      return {
        success: false,
        message: 'Неверный формат ответа от Beds24'
      };

    } catch (error) {
      logger.error('Beds24 API key verification error:', error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
          return {
            success: false,
            message: 'Неверный API ключ. Проверьте правильность ключа в настройках Beds24.'
          };
        }

        if (axiosError.response?.status === 404) {
          return {
            success: false,
            message: 'API endpoint не найден. Проверьте API ключ.'
          };
        }

        if (axiosError.response?.status === 429) {
          return {
            success: false,
            message: 'Превышен лимит запросов Beds24. Попробуйте через несколько минут.'
          };
        }
        
        return {
          success: false,
          message: axiosError.message || 'Ошибка при проверке ключа'
        };
      }

      return {
        success: false,
        message: 'Неизвестная ошибка при проверке API ключа'
      };
    }
  }

  /**
   * ✅ ОПТИМИЗИРОВАНО: Получить все объекты с rooms одним запросом
   */
  async getPropertiesWithRooms(apiKey: string): Promise<Beds24ApiResponse> {
    try {
      logger.info('=== START: Fetching Beds24 properties ===');

      const response = await axios.post(
        `${this.BASE_URL}/getProperties`,
        {
          authentication: {
            apiKey: apiKey
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: this.TIMEOUT
        }
      );

      // ✅ Данные в response.data.getProperties
      const properties: Beds24Property[] = response.data?.getProperties || [];

      if (response.data?.error) {
        logger.error('Beds24 API error:', response.data.error);
        return {
          success: false,
          message: response.data.error
        };
      }

      logger.info(`Fetched ${properties.length} properties from Beds24`);

      // ✅ Преобразуем в нужный формат
      const propertiesWithRooms = properties.map(property => {
        const rooms = (property.roomTypes || []).map(roomType => ({
          roomId: parseInt(roomType.roomId),
          roomName: roomType.name,
          propId: parseInt(property.propId)
        }));

        logger.info(`Property: ${property.name} (ID: ${property.propId}) has ${rooms.length} rooms`);

        return {
          propId: parseInt(property.propId),
          propName: property.name,
          rooms: rooms
        };
      });

      logger.info(`=== END: Successfully processed ${properties.length} properties ===`);

      return {
        success: true,
        data: propertiesWithRooms
      };
    } catch (error) {
      logger.error('ERROR in getPropertiesWithRooms:', error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        
        if (axiosError.response?.status === 429) {
          return {
            success: false,
            message: 'Превышен лимит запросов Beds24. Попробуйте позже.'
          };
        }
        
        return {
          success: false,
          message: axiosError.response?.data?.error || axiosError.message || 'Ошибка при получении списка объектов'
        };
      }

      return {
        success: false,
        message: 'Ошибка при получении объектов из Beds24'
      };
    }
  }
}

export default new Beds24Service();