// backend/src/routes/maps.routes.ts
import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../utils/logger';

const router = Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/**
 * Разворачивает короткую ссылку Google Maps и извлекает координаты и адрес
 * POST /api/maps/expand-url
 */
router.post('/expand-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    logger.info(`Expand URL request: ${url}`);

    if (!url) {
      res.status(400).json({
        success: false,
        message: 'URL is required'
      });
      return;
    }

    let normalizedUrl = normalizeGoogleMapsUrl(url);
    logger.info(`Normalized URL: ${normalizedUrl}`);

    let finalUrl = normalizedUrl;

    if (normalizedUrl.includes('maps.app.goo.gl') || normalizedUrl.includes('goo.gl/maps')) {
      try {
        const response = await axios.get(normalizedUrl, {
          maxRedirects: 10,
          validateStatus: () => true,
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        finalUrl = response.request?.res?.responseUrl || response.request?.url || normalizedUrl;
        logger.info(`URL expanded to: ${finalUrl}`);
      } catch (error) {
        logger.warn('Failed to expand URL, trying to extract from original:', error);
      }
    }

    const coordinates = extractCoordinates(finalUrl);

    if (coordinates) {
      logger.info(`Extracted coordinates: ${coordinates.lat}, ${coordinates.lng}`);
      
      let address: string | null = null;
      
      if (GOOGLE_MAPS_API_KEY) {
        try {
          address = await getAddressFromCoordinates(coordinates.lat, coordinates.lng);
          if (address) {
            logger.info(`Geocoded address: ${address}`);
          }
        } catch (geocodeError) {
          logger.warn('Failed to geocode address, falling back to URL extraction:', geocodeError);
          address = extractAddress(finalUrl);
        }
      } else {
        logger.warn('Google Maps API key not configured, using URL extraction');
        address = extractAddress(finalUrl);
      }

      res.json({
        success: true,
        data: {
          coordinates: coordinates,
          address: address
        }
      });
    } else {
      logger.warn(`Could not extract coordinates from URL: ${finalUrl}`);
      res.status(400).json({
        success: false,
        message: 'Could not extract coordinates from URL. Please check the link format.'
      });
    }
  } catch (error: any) {
    logger.error('Expand URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process URL'
    });
  }
});

/**
 * Получение адреса по координатам через Google Geocoding API
 */
async function getAddressFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.warn('Google Maps API key is not configured');
      return null;
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=en`;
    
    logger.info(`Geocoding request: ${lat}, ${lng}`);

    const response = await axios.get(geocodeUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data.status === 'OK' && response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      
      // ✅ ИСПРАВЛЕНО: Используем formatted_address или собираем из компонентов
      let address = result.formatted_address;
      
      // Если formatted_address пустой - собираем адрес из компонентов
      if (!address && result.address_components) {
        address = buildDetailedAddress(result.address_components);
        logger.info(`Built address from components: ${address}`);
      }
      
      if (address) {
        logger.info(`Geocoding successful: ${address}`);
        return address;
      }
    }
    
    logger.warn(`Geocoding failed: ${response.data.status}`);
    return null;
  } catch (error: any) {
    logger.error('Geocoding error:', error.message);
    return null;
  }
}

/**
 * ✅ ИСПРАВЛЕНО: Теперь используется
 * Построение детального адреса из компонентов Google Geocoding API
 */
function buildDetailedAddress(addressComponents: any[]): string {
  const components: { [key: string]: string } = {};
  
  addressComponents.forEach((component: any) => {
    const types = component.types;
    const longName = component.long_name;
    
    if (types.includes('street_number')) {
      components.street_number = longName;
    }
    if (types.includes('route')) {
      components.route = longName;
    }
    if (types.includes('locality')) {
      components.locality = longName;
    }
    if (types.includes('administrative_area_level_1')) {
      components.admin_area_1 = longName;
    }
    if (types.includes('administrative_area_level_2')) {
      components.admin_area_2 = longName;
    }
    if (types.includes('country')) {
      components.country = longName;
    }
    if (types.includes('postal_code')) {
      components.postal_code = longName;
    }
    if (types.includes('sublocality') || types.includes('neighborhood')) {
      components.neighborhood = longName;
    }
  });
  
  const addressParts: string[] = [];
  
  if (components.street_number && components.route) {
    addressParts.push(`${components.street_number} ${components.route}`);
  } else if (components.route) {
    addressParts.push(components.route);
  }
  
  if (components.neighborhood) {
    addressParts.push(components.neighborhood);
  }
  
  if (components.locality) {
    addressParts.push(components.locality);
  } else if (components.admin_area_2) {
    addressParts.push(components.admin_area_2);
  }
  
  if (components.admin_area_1) {
    addressParts.push(components.admin_area_1);
  }
  
  if (components.postal_code) {
    addressParts.push(components.postal_code);
  }
  
  if (components.country) {
    addressParts.push(components.country);
  }
  
  return addressParts.join(', ');
}

/**
 * Нормализация URL Google Maps
 */
function normalizeGoogleMapsUrl(url: string): string {
  let normalized = url.trim();
  
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  if (normalized.includes('maps.app.goo.gl') || normalized.includes('goo.gl/maps')) {
    const questionMarkIndex = normalized.indexOf('?');
    if (questionMarkIndex > -1) {
      const hashIndex = normalized.indexOf('#');
      if (hashIndex > -1 && hashIndex < questionMarkIndex) {
        normalized = normalized.substring(0, hashIndex);
      } else {
        normalized = normalized.substring(0, questionMarkIndex);
      }
    }
  }
  
  return normalized;
}

/**
 * Извлечение адреса из URL (FALLBACK метод)
 */
function extractAddress(url: string): string | null {
  try {
    logger.info(`Attempting to extract address from URL (fallback method)`);

    let match = url.match(/\/place\/([^/@?]+)(?:\/|@)/);
    if (match) {
      const encodedPlace = match[1];
      const decodedPlace = decodeURIComponent(encodedPlace)
        .replace(/\+/g, ' ')
        .trim();
      
      if (decodedPlace && !decodedPlace.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
        logger.info(`URL extraction successful: ${decodedPlace}`);
        return decodedPlace;
      }
    }

    match = url.match(/\/search\/([^/@?]+)(?:\/|@|\?|$)/);
    if (match) {
      const encodedSearch = match[1];
      const decodedSearch = decodeURIComponent(encodedSearch)
        .replace(/\+/g, ' ')
        .trim();
      
      if (decodedSearch && !decodedSearch.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
        logger.info(`URL extraction successful: ${decodedSearch}`);
        return decodedSearch;
      }
    }

    match = url.match(/[?&]q=([^&@]+)/);
    if (match) {
      const encodedQuery = match[1];
      const decodedQuery = decodeURIComponent(encodedQuery)
        .replace(/\+/g, ' ')
        .trim();
      
      if (decodedQuery && !decodedQuery.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
        logger.info(`URL extraction successful: ${decodedQuery}`);
        return decodedQuery;
      }
    }

    logger.info('URL extraction found no address');
    return null;
  } catch (error) {
    logger.error('Error extracting address from URL:', error);
    return null;
  }
}

/**
 * Извлечение координат из URL Google Maps
 */
function extractCoordinates(url: string): { lat: number; lng: number } | null {
  try {
    logger.info(`Attempting to extract coordinates from: ${url}`);

    let match = url.match(/\/search\/(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: /search/lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
    if (match) {
      logger.info('Pattern matched: @lat,lng,zoom');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:[,?&]|$)/);
    if (match) {
      logger.info('Pattern matched: @lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: ?q=lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    match = url.match(/\/place\/[^/]*\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: /place/@lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    match = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: ll=lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    match = url.match(/[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: center=lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    const lat3dMatch = url.match(/!3d(-?\d+\.?\d*)/);
    const lng4dMatch = url.match(/!4d(-?\d+\.?\d*)/);
    if (lat3dMatch && lng4dMatch) {
      logger.info('Pattern matched: !3d!4d format');
      return { 
        lat: parseFloat(lat3dMatch[1]), 
        lng: parseFloat(lng4dMatch[1]) 
      };
    }

    const dataMatch = url.match(/\/data=[^!]*!3d(-?\d+\.?\d*)[^!]*!4d(-?\d+\.?\d*)/);
    if (dataMatch) {
      logger.info('Pattern matched: /data=...!3d!4d');
      return {
        lat: parseFloat(dataMatch[1]),
        lng: parseFloat(dataMatch[2])
      };
    }

    const lastAtMatch = url.split('@').pop();
    if (lastAtMatch) {
      const coordMatch = lastAtMatch.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (coordMatch) {
        logger.info('Pattern matched: last @ coordinates');
        return {
          lat: parseFloat(coordMatch[1]),
          lng: parseFloat(coordMatch[2])
        };
      }
    }

    logger.warn('No pattern matched for URL');
    return null;
  } catch (error) {
    logger.error('Error extracting coordinates:', error);
    return null;
  }
}

export default router;