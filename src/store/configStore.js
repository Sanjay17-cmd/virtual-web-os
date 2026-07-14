/**
 * configStore.js
 * Local configuration state aligned to the Supabase schema contract.
 * Mirrors `public.user_configs` and `public.app_registry` table structures.
 * This will be replaced by live Supabase queries once the backend is connected.
 */
import { create } from 'zustand';
import { APP_REGISTRY } from './osStore';

const useConfigStore = create((set) => ({
  // ─── User Preferences (mirrors public.user_configs) ──────────────────────
  userPrefs: {
    theme: 'dark',
    animations_enabled: true,
    wallpaper_url: '',                // Will be populated from Supabase storage URL
    ubuntu_sidebar_expanded: true,
  },

  // ─── Installed Applications (mirrors public.app_registry) ────────────────
  installedApps: APP_REGISTRY,

  // ─── Actions ─────────────────────────────────────────────────────────────

  /** Merge-update specific user preference keys */
  updateUserPrefs: (partial) =>
    set(state => ({
      userPrefs: { ...state.userPrefs, ...partial },
    })),

  /** Replace the installed apps list (e.g., after fetching from Supabase) */
  setInstalledApps: (apps) => set({ installedApps: apps }),
}));

export default useConfigStore;
