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
let isRedirecting = false; // ✅ НОВЫЙ ФЛАГ для предотвращения множественных редиректов
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

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

// ✅ Функция для очистки авторизации и редиректа
const clearAuthAndRedirect = () => {
  if (isRedirecting) {
    return; // Уже редиректим, не делаем повторно
  }
  
  isRedirecting = true;
  isRefreshing = false;
  failedQueue = [];
  
  // Очищаем токены
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  
  // Очищаем zustand store (auth-storage)
  localStorage.removeItem('auth-storage');
  
  // Небольшая задержка перед редиректом, чтобы все запросы завершились
  setTimeout(() => {
    window.location.href = '/login';
  }, 100);
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Если уже идёт редирект - не добавляем токен и отменяем запрос
    if (isRedirecting) {
      const controller = new AbortController();
      controller.abort();
      config.signal = controller.signal;
      return config;
    }
    
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

    // ✅ ИСПРАВЛЕНО: Проверяем URL без baseURL (используем includes для надёжности)
    // originalRequest.url будет '/auth/refresh', а не '/api/auth/refresh'
    if (originalRequest?.url?.includes('/auth/refresh')) {
      // Если сам refresh endpoint вернул ошибку - очищаем и редиректим
      console.log('Refresh token failed, redirecting to login...');
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // Если токен истёк (401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Если уже идёт процесс обновления токена
      if (isRefreshing) {
        // Добавляем запрос в очередь
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
      
      // Если нет refresh токена - сразу редиректим
      if (!refreshToken) {
        console.log('No refresh token available, redirecting to login...');
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        // Добавляем таймаут для refresh запроса
        // Используем чистый axios чтобы избежать рекурсии с interceptor
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
        
        // Если есть новый refresh token - тоже сохраняем
        if (data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        
        // Обновляем токен в оригинальном запросе
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        
        // Обрабатываем очередь
        processQueue(null, newAccessToken);
        isRefreshing = false;
        
        return api(originalRequest);
      } catch (refreshError: any) {
        // Если обновление токена не удалось
        console.log('Token refresh failed:', refreshError?.response?.status || refreshError?.message);
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;