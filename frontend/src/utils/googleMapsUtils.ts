/// <reference types="vite/client" />

// frontend/src/utils/googleMapsUtils.ts

/**
 * Проверяет, является ли строка ссылкой Google Maps
 */
export const isGoogleMapsLink = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  
  const normalizedUrl = url.toLowerCase().trim();
  
  // Поддерживаем все возможные форматы
  return (
    normalizedUrl.includes('maps.app.goo.gl') ||
    normalizedUrl.includes('google.com/maps') ||
    normalizedUrl.includes('maps.google.com') ||
    normalizedUrl.includes('goo.gl/maps')
  );
};

/**
 * Нормализует URL Google Maps
 */
export const normalizeGoogleMapsUrl = (url: string): string => {
  let normalizedUrl = url.trim();
  
  // Добавляем https:// если отсутствует протокол
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }
  
  // Удаляем параметры после ? если это короткая ссылка goo.gl
  if (normalizedUrl.includes('maps.app.goo.gl') || normalizedUrl.includes('goo.gl/maps')) {
    const questionMarkIndex = normalizedUrl.indexOf('?');
    if (questionMarkIndex > -1) {
      normalizedUrl = normalizedUrl.substring(0, questionMarkIndex);
    }
  }
  
  return normalizedUrl;
};

/**
 * Извлекает координаты и адрес из ссылки Google Maps через бэкенд
 */
export const extractCoordinatesFromGoogleMapsLink = async (url: string) => {
  try {
    console.log('Extracting coordinates from:', url);

    // Проверяем формат ссылки
    if (!isGoogleMapsLink(url)) {
      throw new Error('Invalid Google Maps URL format');
    }

    // Нормализуем URL
    const normalizedUrl = normalizeGoogleMapsUrl(url);
    console.log('Normalized URL:', normalizedUrl);

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
      body: JSON.stringify({ url: normalizedUrl })
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

    // Backend возвращает data.data с coordinates и address
    if (data.success && data.data) {
      console.log('Coordinates received:', data.data.coordinates);
      console.log('Address received:', data.data.address);
      
      return {
        coordinates: data.data.coordinates,
        address: data.data.address || null
      };
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