// frontend/src/modules/Users/types.ts
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

export interface UserFormData {
  username: string;
  password?: string;
  full_name: string;
  email?: string;
  role_ids?: number[];
  is_active?: boolean;
}