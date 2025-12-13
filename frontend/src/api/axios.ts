// frontend/src/api/axios.ts
import axios from 'axios';

// Используем относительный URL - он автоматически будет HTTPS если сайт на HTTPS
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Глобальные переменные для предотвращения race condition
let isRefreshing = false;
let isRedirecting = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

// ✅ Интервал фонового обновления токена
let backgroundRefreshInterval: ReturnType<typeof setInterval> | null = null;

const processQueue = (error: any = null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// ✅ Функция для декодирования JWT токена (без верификации подписи)
const decodeToken = (token: string): { exp?: number; iat?: number } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
};

// ✅ Проверка, истекает ли токен скоро (менее чем через N минут)
const isTokenExpiringSoon = (token: string, minutesThreshold: number = 30): boolean => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true; // Если не можем декодировать - считаем что истекает
  
  const expiresAt = decoded.exp * 1000; // В миллисекунды
  const now = Date.now();
  const thresholdMs = minutesThreshold * 60 * 1000;
  
  return (expiresAt - now) < thresholdMs;
};

// ✅ Проверка, истёк ли токен
const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  const expiresAt = decoded.exp * 1000;
  return Date.now() >= expiresAt;
};

// ✅ Функция для очистки авторизации и редиректа
const clearAuthAndRedirect = () => {
  if (isRedirecting) {
    return;
  }
  
  isRedirecting = true;
  isRefreshing = false;
  failedQueue = [];
  
  // Останавливаем фоновое обновление
  stopBackgroundRefresh();
  
  // Очищаем токены
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('auth-storage');
  
  setTimeout(() => {
    window.location.href = '/login';
  }, 100);
};

// ✅ Тихое обновление токена (без редиректа при ошибке)
const silentRefreshToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    console.log('[Auth] No refresh token available for silent refresh');
    return null;
  }
  
  // Проверяем, не истёк ли refresh token
  if (isTokenExpired(refreshToken)) {
    console.log('[Auth] Refresh token expired');
    return null;
  }
  
  try {
    console.log('[Auth] Performing silent token refresh...');
    
    const { data } = await axios.post(
      '/api/auth/refresh',
      { refreshToken },
      { 
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (data.success && data.data.accessToken) {
      const newAccessToken = data.data.accessToken;
      localStorage.setItem('accessToken', newAccessToken);
      
      if (data.data.refreshToken) {
        localStorage.setItem('refreshToken', data.data.refreshToken);
      }
      
      console.log('[Auth] Token refreshed successfully');
      return newAccessToken;
    }
    
    return null;
  } catch (error: any) {
    console.log('[Auth] Silent refresh failed:', error?.message || 'Unknown error');
    return null;
  }
};

// ✅ Проактивное обновление токена (вызывается перед запросами)
const proactiveRefresh = async (): Promise<void> => {
  const accessToken = localStorage.getItem('accessToken');
  
  if (!accessToken) return;
  
  // Если токен истекает в течение 30 минут - обновляем заранее
  if (isTokenExpiringSoon(accessToken, 30)) {
    if (!isRefreshing) {
      isRefreshing = true;
      await silentRefreshToken();
      isRefreshing = false;
    }
  }
};

// ✅ Фоновое обновление токена (каждые 30 минут)
const startBackgroundRefresh = () => {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
  }
  
  // Обновляем токен каждые 30 минут
  const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 минут
  
  backgroundRefreshInterval = setInterval(async () => {
    const accessToken = localStorage.getItem('accessToken');
    
    if (accessToken && !isRedirecting) {
      console.log('[Auth] Background token refresh triggered');
      await silentRefreshToken();
    }
  }, REFRESH_INTERVAL);
  
  console.log('[Auth] Background refresh started (every 30 minutes)');
};

const stopBackgroundRefresh = () => {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
    backgroundRefreshInterval = null;
    console.log('[Auth] Background refresh stopped');
  }
};

// ✅ Инициализация при загрузке модуля
const initAuth = () => {
  const accessToken = localStorage.getItem('accessToken');
  
  if (accessToken) {
    // Запускаем фоновое обновление если есть токен
    startBackgroundRefresh();
    
    // Проверяем токен сразу при инициализации
    if (isTokenExpiringSoon(accessToken, 60)) {
      console.log('[Auth] Token expiring soon, refreshing on init...');
      silentRefreshToken();
    }
  }
};

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Если уже идёт редирект - отменяем запрос
    if (isRedirecting) {
      const controller = new AbortController();
      controller.abort();
      config.signal = controller.signal;
      return config;
    }
    
    // ✅ Проактивное обновление токена перед запросом
    await proactiveRefresh();
    
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor с защитой от race condition
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Если запрос был отменён из-за редиректа - просто возвращаем ошибку
    if (axios.isCancel(error) || isRedirecting) {
      return Promise.reject(error);
    }
    
    const originalRequest = error.config;

    // Если это refresh endpoint вернул ошибку - очищаем и редиректим
    if (originalRequest?.url?.includes('/auth/refresh')) {
      console.log('[Auth] Refresh token failed, redirecting to login...');
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // Если токен истёк (401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Если уже идёт процесс обновления токена
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken || isTokenExpired(refreshToken)) {
        console.log('[Auth] No valid refresh token, redirecting to login...');
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          { refreshToken },
          { 
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        const newAccessToken = data.data.accessToken;
        localStorage.setItem('accessToken', newAccessToken);
        
        if (data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        
        processQueue(null, newAccessToken);
        isRefreshing = false;
        
        // ✅ Перезапускаем фоновое обновление после успешного refresh
        startBackgroundRefresh();
        
        return api(originalRequest);
      } catch (refreshError: any) {
        console.log('[Auth] Token refresh failed:', refreshError?.response?.status || refreshError?.message);
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ✅ Инициализируем при загрузке
initAuth();

// ✅ Экспортируем функции для использования в других модулях
export { startBackgroundRefresh, stopBackgroundRefresh, silentRefreshToken };

export default api;