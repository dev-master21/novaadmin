// backend/src/types/index.ts
import { Request } from 'express';

export interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  roles?: Role[];
  permissions?: string[];
}

export interface Role {
  id: number;
  role_name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  permission_name: string;
  module: string;
  description: string | null;
}

export interface AuthRequest extends Request {
  admin?: AdminUser;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: Omit<AdminUser, 'password_hash'>;
    accessToken: string;
    refreshToken: string;
  };
}

export interface PropertyWithCreator {
  id: number;
  property_number: string;
  deal_type: string;
  property_type: string;
  bedrooms: number;
  sale_price: number | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  created_by: number;
  creator_name: string; // Имя пользователя, который создал объект
  creator_username: string; // Логин пользователя
  property_name?: string; // Название из translations
}