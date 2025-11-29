// frontend/src/api/publicAxios.ts
import axios from 'axios';

// Публичный axios instance БЕЗ авторизации и редиректов
const publicApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// НЕТ request interceptor для добавления токена
// НЕТ response interceptor для обработки 401

export default publicApi;