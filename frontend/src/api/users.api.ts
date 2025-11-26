// frontend/src/api/users.api.ts
import api from './axios';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  roles?: string[];
}

export const usersApi = {
  getAll: () => api.get<{ success: boolean; data: User[] }>('/users'),

  getById: (id: number) => api.get(`/users/${id}`),

  create: (data: {
    username: string;
    password: string;
    full_name: string;
    email?: string;
    role_ids?: number[];
  }) => api.post('/users', data),

  update: (id: number, data: {
    full_name?: string;
    email?: string;
    password?: string;
    role_ids?: number[];
    is_active?: boolean;
  }) => api.put(`/users/${id}`, data),

  delete: (id: number) => api.delete(`/users/${id}`)
};