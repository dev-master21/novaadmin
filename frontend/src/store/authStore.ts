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