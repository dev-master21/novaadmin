// frontend/src/api/users.api.ts
import api from './axios';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  partner_id: number | null;
  partner_name?: string;
  partner_domain?: string;
  last_login_at: string | null;
  created_at: string;
  roles?: any[];
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
    partner_id?: number | null;
  }) => api.post('/users', data),

  update: (id: number, data: {
    full_name?: string;
    email?: string;
    password?: string;
    role_ids?: number[];
    is_active?: boolean;
    partner_id?: number | null;
  }) => api.put(`/users/${id}`, data),

  delete: (id: number) => api.delete(`/users/${id}`)
};