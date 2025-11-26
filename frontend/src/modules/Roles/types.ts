// frontend/src/modules/Roles/types.ts
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

export interface RoleFormData {
  role_name: string;
  description?: string;
  permission_ids: number[];
}