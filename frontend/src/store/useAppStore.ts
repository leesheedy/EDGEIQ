import { create } from 'zustand';
import type { BankrollStats, Settings, ScraperStatus } from '../types';
import { bankrollApi, settingsApi, scraperApi } from '../lib/api';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface AppState {
  // Auth — session only, never persisted
  authenticated: boolean;
  unlock: () => void;
  lock: () => void;

  // Bankroll
  bankrollStats: BankrollStats | null;
  loadBankroll: () => Promise<void>;

  // Settings
  settings: Settings | null;
  loadSettings: () => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;

  // Scraper
  scraperStatus: ScraperStatus | null;
  loadScraperStatus: () => Promise<void>;
  triggerScrape: () => Promise<void>;

  // Toasts
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  // Global loading
  isLoading: boolean;
  setLoading: (v: boolean) => void;

  // Backend connection
  backendConnected: boolean;
  setBackendConnected: (v: boolean) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  authenticated: false,
  unlock: () => set({ authenticated: true }),
  lock: () => set({ authenticated: false }),

  bankrollStats: null,
  loadBankroll: async () => {
    try {
      const stats = await bankrollApi.stats();
      set({ bankrollStats: stats });
    } catch {
      //
    }
  },

  settings: null,
  loadSettings: async () => {
    try {
      const settings = await settingsApi.get();
      set({ settings });
    } catch {
      //
    }
  },
  updateSettings: async (updates) => {
    await settingsApi.update(updates);
    const settings = await settingsApi.get();
    set({ settings });
  },

  scraperStatus: null,
  loadScraperStatus: async () => {
    try {
      const status = await scraperApi.status();
      set({ scraperStatus: status });
    } catch {
      //
    }
  },
  triggerScrape: async () => {
    try {
      const status = await scraperApi.trigger();
      set({ scraperStatus: status });
      get().addToast('info', 'Scrape triggered — new data incoming');
    } catch {
      get().addToast('error', 'Failed to trigger scrape');
    }
  },

  toasts: [],
  addToast: (type, message) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  isLoading: false,
  setLoading: (v) => set({ isLoading: v }),

  backendConnected: false,
  setBackendConnected: (v) => set({ backendConnected: v }),
}));
