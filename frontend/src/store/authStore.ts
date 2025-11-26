// frontend/src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at?: string;    // ✅ Уже опциональное
  created_at?: string;        // ✅ СДЕЛАТЬ ОПЦИОНАЛЬНЫМ
  updated_at?: string;        // ✅ Уже опциональное
  roles: Array<{
    id: number;
    role_name: string;
    permissions: Array<{
      permission_name: string;
      module: string;
    }>;
  }>;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  isSuperAdmin: () => boolean;
  // ✅ НОВЫЕ МЕТОДЫ для работы с недвижимостью
  canEditProperty: (createdBy: number | null | undefined) => boolean;
  canViewPropertyOwner: (createdBy: number | null | undefined) => boolean;
  canChangePropertyStatus: () => boolean;
  canDeleteProperty: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      clearAuth: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, isAuthenticated: false });
      },

      hasPermission: (permission: string): boolean => {
        const { user } = get();
        if (!user) return false;
        if (user.is_super_admin) return true;

        return user.roles.some(role =>
          role.permissions.some(p => p.permission_name === permission)
        );
      },

      isSuperAdmin: (): boolean => {
        const { user } = get();
        return user?.is_super_admin || false;
      },

      // ✅ НОВЫЙ МЕТОД: Может ли пользователь редактировать объект
      canEditProperty: (createdBy: number | null | undefined): boolean => {
        const { user } = get();
        if (!user) return false;
        
        // Super admin может всё
        if (user.is_super_admin) return true;
        
        // Если есть права на редактирование - может редактировать все объекты
        if (get().hasPermission('properties.update')) return true;
        
        // Если нет прав, но пользователь создатель - может редактировать свой объект
        if (createdBy && user.id === createdBy) return true;
        
        return false;
      },

      // ✅ ИСПРАВЛЕНО: Вкладка "Владелец" только для properties.update или super admin
      canViewPropertyOwner: (createdBy: number | null | undefined): boolean => {
        const { user } = get();
        if (!user) return false;
        
        // Super admin может видеть всё
        if (user.is_super_admin) return true;
        
        // Если есть права на редактирование всех объектов
        if (get().hasPermission('properties.update')) return true;
        
        // Если пользователь создатель объекта - показываем вкладку
        if (createdBy && user.id === createdBy) return true;
        
        return false;
      },

      // ✅ НОВЫЙ МЕТОД: Может ли изменять статус (только super admin)
      canChangePropertyStatus: (): boolean => {
        const { user } = get();
        return user?.is_super_admin || false;
      },

      // ✅ НОВЫЙ МЕТОД: Может ли удалять объекты (только super admin)
      canDeleteProperty: (): boolean => {
        const { user } = get();
        return user?.is_super_admin || false;
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);