// backend/src/routes/maps.routes.ts
import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * POST /api/maps/expand-url
 * Разворачивает короткую ссылку Google Maps и извлекает координаты
 */
router.post('/expand-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({
        success: false,
        message: 'URL is required'
      });
      return;
    }

    // Проверяем формат ссылки
    if (!url.includes('maps.app.goo.gl') && !url.includes('google.com/maps')) {
      res.status(400).json({
        success: false,
        message: 'Invalid Google Maps URL format'
      });
      return;
    }

    // Если это короткая ссылка, разворачиваем её
    let expandedUrl = url;
    if (url.includes('maps.app.goo.gl')) {
      const response = await axios.get(url, {
        maxRedirects: 5,
        validateStatus: () => true
      });
      expandedUrl = response.request.res.responseUrl || url;
    }

    // Извлекаем координаты из URL
    const coordinatePatterns = [
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,           // @lat,lng
      /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,       // !3dlat!4dlng
      /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,         // ll=lat,lng
      /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/      // center=lat,lng
    ];

    let coordinates = null;
    for (const pattern of coordinatePatterns) {
      const match = expandedUrl.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        
        // Валидация координат
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          coordinates = { lat, lng };
          break;
        }
      }
    }

    if (!coordinates) {
      res.status(400).json({
        success: false,
        message: 'Could not extract coordinates from URL'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        coordinates,
        expandedUrl
      }
    });
  } catch (error: any) {
    console.error('Expand URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process Google Maps URL'
    });
  }
});

export default router;