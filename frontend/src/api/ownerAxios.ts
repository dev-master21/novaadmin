// frontend/src/api/ownerAxios.ts
import axios from 'axios';

const ownerApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

let isRefreshing = false;
let isRedirecting = false;
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

// ✅ Функция для получения токена из store
const getOwnerAccessToken = (): string | null => {
  try {
    const storageData = localStorage.getItem('owner-auth-storage');
    if (!storageData) return null;
    
    const parsed = JSON.parse(storageData);
    return parsed?.state?.accessToken || null;
  } catch (error) {
    console.error('Error parsing owner storage:', error);
    return null;
  }
};

// ✅ Функция для получения refresh token из store
const getOwnerRefreshToken = (): string | null => {
  try {
    const storageData = localStorage.getItem('owner-auth-storage');
    if (!storageData) return null;
    
    const parsed = JSON.parse(storageData);
    return parsed?.state?.refreshToken || null;
  } catch (error) {
    console.error('Error parsing owner storage:', error);
    return null;
  }
};

// ✅ Функция для обновления токенов в store
const updateOwnerTokens = (accessToken: string, refreshToken: string) => {
  try {
    const storageData = localStorage.getItem('owner-auth-storage');
    if (!storageData) return;
    
    const parsed = JSON.parse(storageData);
    if (parsed && parsed.state) {
      parsed.state.accessToken = accessToken;
      parsed.state.refreshToken = refreshToken;
      localStorage.setItem('owner-auth-storage', JSON.stringify(parsed));
    }
  } catch (error) {
    console.error('Error updating owner tokens:', error);
  }
};

const clearAuthAndRedirect = () => {
  if (isRedirecting) {
    return;
  }
  
  isRedirecting = true;
  isRefreshing = false;
  failedQueue = [];
  
  // Очищаем все токены владельца
  localStorage.removeItem('owner-auth-storage');
  
  setTimeout(() => {
    // Получаем текущий токен из URL
    const pathParts = window.location.pathname.split('/');
    const token = pathParts[2]; // /owner/TOKEN
    
    if (token && token.length === 64) {
      window.location.href = `/owner/${token}`;
    } else {
      window.location.href = '/';
    }
  }, 100);
};

// Request interceptor
ownerApi.interceptors.request.use(
  (config) => {
    if (isRedirecting) {
      const controller = new AbortController();
      controller.abort();
      config.signal = controller.signal;
      return config;
    }
    
    // ✅ Получаем токен из store
    const token = getOwnerAccessToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Owner API Request with token:', {
        url: config.url,
        method: config.method,
        hasToken: true
      });
    } else {
      console.warn('Owner API Request without token:', {
        url: config.url,
        method: config.method
      });
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
ownerApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isCancel(error) || isRedirecting) {
      return Promise.reject(error);
    }
    
    const originalRequest = error.config;

    // Если это refresh endpoint
    if (originalRequest?.url?.includes('/property-owners/refresh')) {
      console.log('Owner refresh token failed, redirecting to login...');
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // Если токен истёк (401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return ownerApi(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      // ✅ Получаем refresh token из store
      const refreshToken = getOwnerRefreshToken();
      
      if (!refreshToken) {
        console.log('No owner refresh token available, redirecting to login...');
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        console.log('Attempting to refresh owner token...');
        
        const { data } = await axios.post(
          '/api/property-owners/refresh',
          { refreshToken },
          { 
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (data.success) {
          const newAccessToken = data.data.accessToken;
          const newRefreshToken = data.data.refreshToken;
          
          // ✅ Обновляем токены в store
          updateOwnerTokens(newAccessToken, newRefreshToken);
          
          console.log('Owner tokens refreshed successfully');
          
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          
          processQueue(null, newAccessToken);
          isRefreshing = false;
          
          return ownerApi(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshError: any) {
        console.log('Owner token refresh failed:', refreshError?.response?.status || refreshError?.message);
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default ownerApi;