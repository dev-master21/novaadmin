/// <reference types="vite/client" />

// frontend/src/utils/googleMapsUtils.ts

/**
 * Извлекает координаты из ссылки Google Maps через бэкенд
 */
export const extractCoordinatesFromGoogleMapsLink = async (url: string) => {
  try {
    console.log('Extracting coordinates from:', url);

    // Проверяем формат ссылки
    if (!url.includes('maps.app.goo.gl') && !url.includes('google.com/maps')) {
      throw new Error('Invalid Google Maps URL format');
    }

    // Отправляем запрос на бэкенд для обработки
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_URL}/maps/expand-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (response.ok && data.success && data.data.coordinates) {
      console.log('Coordinates received:', data.data.coordinates);
      return data.data.coordinates;
    }

    // Если бэкенд не смог получить координаты
    throw new Error(data.message || 'Could not extract coordinates');
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    throw error;
  }
};

/**
 * Валидация координат
 */
export const validateCoordinates = (lat: number, lng: number) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Форматирование координат для отображения
 */
export const formatCoordinates = (lat: number, lng: number) => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};