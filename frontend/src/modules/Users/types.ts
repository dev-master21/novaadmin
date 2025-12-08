// frontend/src/modules/Users/types.ts
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

export interface UserFormData {
  username: string;
  password?: string;
  full_name: string;
  email?: string;
  role_ids?: number[];
  is_active?: boolean;
  partner_id?: number | null;
}