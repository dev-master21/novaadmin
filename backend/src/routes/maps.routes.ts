// backend/src/routes/maps.routes.ts
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middlewares/auth.middleware';
import logger from '../utils/logger';

const router = Router();

/**
 * Разворачивает короткую ссылку Google Maps и извлекает координаты
 * POST /api/maps/expand-url
 */
router.post('/expand-url', authenticate, async (req: Request, res: Response) => {
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

    let finalUrl = url;

    // Если это короткая ссылка - разворачиваем её
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      try {
        const response = await axios.get(url, {
          maxRedirects: 10,
          validateStatus: () => true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        finalUrl = response.request?.res?.responseUrl || response.request?.url || url;
        logger.info(`URL expanded to: ${finalUrl}`);
      } catch (error) {
        logger.warn('Failed to expand URL, trying to extract from original:', error);
      }
    }

    // Извлекаем координаты из URL
    const coordinates = extractCoordinates(finalUrl);

    if (coordinates) {
      logger.info(`Extracted coordinates: ${coordinates.lat}, ${coordinates.lng}`);
      res.json({
        success: true,
        data: {
          coordinates: coordinates // Возвращаем в старом формате для совместимости
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

function extractCoordinates(url: string): { lat: number; lng: number } | null {
  try {
    logger.info(`Attempting to extract coordinates from: ${url}`);

    // Паттерн 0: /search/lat,lng или /search/lat,+lng
    let match = url.match(/\/search\/(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: /search/lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Паттерн 1: @lat,lng,zoom (самый распространенный)
    match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
    if (match) {
      logger.info('Pattern matched: @lat,lng,zoom');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Паттерн 2: @lat,lng (без zoom)
    match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:[,?&]|$)/);
    if (match) {
      logger.info('Pattern matched: @lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Паттерн 3: ?q=lat,lng
    match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: ?q=lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Паттерн 4: /place/.../@lat,lng
    match = url.match(/\/place\/[^/]*\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: /place/@lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Паттерн 5: ll=lat,lng
    match = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: ll=lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Паттерн 6: center=lat,lng
    match = url.match(/[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      logger.info('Pattern matched: center=lat,lng');
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Паттерн 7: !3d for latitude and !4d for longitude (encoded format)
    const lat3dMatch = url.match(/!3d(-?\d+\.?\d*)/);
    const lng4dMatch = url.match(/!4d(-?\d+\.?\d*)/);
    if (lat3dMatch && lng4dMatch) {
      logger.info('Pattern matched: !3d!4d format');
      return { 
        lat: parseFloat(lat3dMatch[1]), 
        lng: parseFloat(lng4dMatch[1]) 
      };
    }

    logger.warn('No pattern matched for URL');
    return null;
  } catch (error) {
    logger.error('Error extracting coordinates:', error);
    return null;
  }
}

export default router;