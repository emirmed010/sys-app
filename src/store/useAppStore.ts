import { create } from 'zustand';
import { db } from '../data/db';

// ─── Settings Store ──────────────────────────────────────────────
interface SettingsStoreState {
  currency: string;
  workshopName: string;
  phone: string;
  address: string;
  invoiceFooterText: string;
  reload: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  currency: 'MRU',
  workshopName: 'ورشة الألمنيوم',
  phone: '',
  address: '',
  invoiceFooterText: 'شكراً لتعاملكم معنا',
  reload: async () => {
    try {
      const s = await db.settings.get('MASTER');
      if (s) {
        set({
          currency: s.currency || 'MRU',
          workshopName: s.workshopName || 'ورشة الألمنيوم',
          phone: s.phone || '',
          address: s.address || '',
          invoiceFooterText: s.invoiceFooterText || 'شكراً لتعاملكم معنا',
        });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },
}));

// ─── Sidebar Store ───────────────────────────────────────────────
interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),
}));

interface GlobalOverlayState {
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (isLoading: boolean, message?: string) => void;
}

export const useOverlayStore = create<GlobalOverlayState>((set) => ({
  isLoading: false,
  loadingMessage: '',
  setLoading: (isLoading, message = 'يرجى الانتظار...') => 
    set({ isLoading, loadingMessage: message }),
}));
