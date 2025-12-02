// frontend/src/store/ownerStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Owner {
  id: number;
  owner_name: string;
  access_token: string;
  properties_count: number;
  can_edit_calendar: boolean;
  can_edit_pricing: boolean;
}

interface OwnerState {
  owner: Owner | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  
  setAuth: (owner: Owner, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  canEditCalendar: () => boolean;
  canEditPricing: () => boolean;
}

export const useOwnerStore = create<OwnerState>()(
  persist(
    (set, get) => ({
      owner: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (owner, accessToken, refreshToken) => {
        set({
          owner,
          accessToken,
          refreshToken,
          isAuthenticated: true
        });
      },

      clearAuth: () => {
        set({
          owner: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false
        });
      },

      updateTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },

      canEditCalendar: () => {
        const { owner } = get();
        return owner?.can_edit_calendar ?? false;
      },

      canEditPricing: () => {
        const { owner } = get();
        return owner?.can_edit_pricing ?? false;
      }
    }),
    {
      name: 'owner-auth-storage',
      partialize: (state) => ({
        owner: state.owner,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);