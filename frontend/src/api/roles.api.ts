// frontend/src/api/roles.api.ts
import api from './axios';

export interface Role {
  id: number;
  role_name: string;
  description: string | null;
  created_at: string;
  users_count: number;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  permission_name: string;
  module: string;
  description: string | null;
}

export const rolesApi = {
  getAll: () => api.get<{ success: boolean; data: Role[] }>('/roles'),

  getById: (id: number) => api.get(`/roles/${id}`),

  getAllPermissions: () => api.get<{ success: boolean; data: Record<string, Permission[]> }>('/roles/permissions/all'),

  create: (data: {
    role_name: string;
    description?: string;
    permission_ids: number[];
  }) => api.post('/roles', data),

  update: (id: number, data: {
    role_name?: string;
    description?: string;
    permission_ids?: number[];
  }) => api.put(`/roles/${id}`, data),

  delete: (id: number) => api.delete(`/roles/${id}`)
};