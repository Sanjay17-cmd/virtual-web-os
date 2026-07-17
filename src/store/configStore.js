/**
 * configStore.js
 * Local configuration state aligned to the Supabase schema contract.
 * Mirrors `public.user_configs` and `public.app_registry` table structures.
 * Manages installed apps with install/uninstall actions.
 */
import { create } from 'zustand';
import { SYSTEM_APPS } from './osStore';

// Default pre-installed app slugs (system apps always installed)
const DEFAULT_INSTALLED = new Set([
  'app-store',
  'settings',
  'system-diagnostic',
  'text-editor',
]);

const useConfigStore = create((set, get) => ({
  // ─── User Preferences (mirrors public.user_configs) ──────────────────────
  userPrefs: {
    theme: 'dark',
    animations_enabled: true,
    wallpaper_url: '',                // Will be populated from Supabase storage URL
    ubuntu_sidebar_expanded: true,
  },

  // ─── Installed Apps: Set of installed app slugs ───────────────────────────
  installedSlugs: new Set(DEFAULT_INSTALLED),

  // ─── Actions ─────────────────────────────────────────────────────────────

  /** Merge-update specific user preference keys */
  updateUserPrefs: (partial) =>
    set(state => ({
      userPrefs: { ...state.userPrefs, ...partial },
    })),

  /** Check if an app is installed */
  isInstalled: (slug) => get().installedSlugs.has(slug),

  /** Install an app by slug */
  installApp: (slug) =>
    set(state => {
      const next = new Set(state.installedSlugs);
      next.add(slug);
      return { installedSlugs: next };
    }),

  /** Uninstall an app by slug (cannot uninstall system apps) */
  uninstallApp: (slug) => {
    if (SYSTEM_APPS.has(slug)) return; // protect system apps
    set(state => {
      const next = new Set(state.installedSlugs);
      next.delete(slug);
      return { installedSlugs: next };
    });
  },

  /** Get array of installed app slugs */
  getInstalledSlugs: () => [...get().installedSlugs],
}));

export default useConfigStore;
