// frontend/src/api/auth.api.ts
import api from './axios';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      is_super_admin: boolean;
      roles: string[];
      permissions: string[];
    };
    accessToken: string;
    refreshToken: string;
  };
}

export const authApi = {
  login: (credentials: LoginRequest) => 
    api.post<LoginResponse>('/auth/login', credentials),

  logout: (refreshToken: string) => 
    api.post('/auth/logout', { refreshToken }),

  getCurrentUser: () => 
    api.get('/auth/me'),

  refreshToken: (refreshToken: string) => 
    api.post('/auth/refresh', { refreshToken })
};