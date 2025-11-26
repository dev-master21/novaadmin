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

    // Получаем токен из localStorage
    let token = null;
    
    try {
      const accessTokenData = localStorage.getItem('accessToken');
      if (accessTokenData) {
        const parsed = JSON.parse(accessTokenData);
        token = parsed.accessToken || parsed.token || accessTokenData;
      }
    } catch (e) {
      token = localStorage.getItem('accessToken');
    }

    if (!token) {
      token = localStorage.getItem('token') || 
              localStorage.getItem('authToken') || 
              localStorage.getItem('jwt');
    }
    
    if (!token) {
      throw new Error('Токен авторизации не найден. Пожалуйста, войдите в систему.');
    }

    // Отправляем запрос на бэкенд для обработки
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_URL}/maps/expand-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    console.log('Backend response:', data);

    // Проверяем статус ответа
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Сессия истекла. Пожалуйста, войдите заново.');
      }
      throw new Error(data.message || 'Ошибка при получении координат');
    }

    // Backend возвращает data.data.coordinates для совместимости
    if (data.success && data.data && data.data.coordinates) {
      console.log('Coordinates received:', data.data.coordinates);
      return data.data.coordinates;
    }

    throw new Error(data.message || 'Не удалось извлечь координаты из ссылки');
  } catch (error: any) {
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