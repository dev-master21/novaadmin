// frontend/src/store/appStore.ts
import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  language: string;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setLanguage: (language: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: window.innerWidth < 768,
  language: localStorage.getItem('language') || 'ru',
  theme: 'dark',

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setLanguage: (language) => {
    localStorage.setItem('language', language);
    set({ language });
  },

  setTheme: (theme) => set({ theme })
}));