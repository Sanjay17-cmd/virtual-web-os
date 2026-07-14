/**
 * configStore.js
 * Global configuration + App Registry state store.
 * Mirrors public.user_configs, public.app_registry, and public.user_installed_apps.
 *
 * Key design decisions:
 *  - availableApps: ALL apps in the registry (native + installable)
 *  - installedApps: apps currently active for this user on the taskbar
 *    In offline/mock mode, native apps are pre-installed; installable apps start uninstalled.
 *  - Native apps (is_native: true) can be shown as installed but cannot be uninstalled.
 *  - Installable apps (is_native: false) can be installed / uninstalled freely.
 */
import { create } from 'zustand';
import { APP_REGISTRY as FALLBACK_REGISTRY } from './osStore';

// Derive the default installed set from native apps only
const NATIVE_APPS = FALLBACK_REGISTRY.filter(a => a.is_native);

const useConfigStore = create((set, get) => ({

  // ── User session ──────────────────────────────────────────────────────────
  currentUser: null,

  // ── User Preferences (mirrors public.user_configs) ────────────────────────
  userPrefs: {
    theme:                   'dark',
    animations_enabled:      true,
    wallpaper_url:           '',
    ubuntu_sidebar_expanded: true,
  },

  // ── App Registry ─────────────────────────────────────────────────────────
  // All apps (native + installable) — seeded from local fallback
  availableApps: FALLBACK_REGISTRY,

  // Apps active on the taskbar — native apps pre-installed, installable apps start empty
  installedApps: NATIVE_APPS,

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Store the authenticated user object */
  setCurrentUser: (user) => set({ currentUser: user }),

  /** Merge-update specific user preference keys */
  updateUserPrefs: (partial) =>
    set(state => ({
      userPrefs: { ...state.userPrefs, ...partial },
    })),

  /**
   * fetchAppRegistry(supabase)
   * Loads all rows from public.app_registry into availableApps.
   */
  fetchAppRegistry: async (supabase) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('app_registry')
        .select('*')
        .order('name');
      if (error) throw error;
      if (data?.length) {
        set({ availableApps: data });
        console.info(`[AppRegistry] Loaded ${data.length} apps from Supabase.`);
      }
    } catch (err) {
      console.error('[AppRegistry] fetchAppRegistry error:', err);
    }
  },

  /**
   * fetchInstalledApps(supabase, userId)
   * Loads user's installed apps by joining user_installed_apps → app_registry.
   * Native apps are always merged in (they are pre-installed OS-wide).
   */
  fetchInstalledApps: async (supabase, userId) => {
    if (!supabase || !userId) return;
    try {
      const { data, error } = await supabase
        .from('user_installed_apps')
        .select('id, app_registry(*)')
        .eq('user_id', userId);
      if (error) throw error;

      // Flatten joined rows
      const userInstalled = (data ?? [])
        .map(item => item.app_registry
          ? { ...item.app_registry, installation_id: item.id }
          : null
        )
        .filter(Boolean);

      // Merge: native apps are always included; user-installed adds on top
      const { availableApps } = get();
      const nativeApps = (availableApps.length ? availableApps : FALLBACK_REGISTRY)
        .filter(a => a.is_native);
      const installedSlugs = new Set(userInstalled.map(a => a.slug));
      const merged = [
        ...nativeApps,
        ...userInstalled.filter(a => !a.is_native && !installedSlugs.has(a.slug)),
      ];

      set({ installedApps: merged });
      console.info(`[AppRegistry] User has ${merged.length} installed app(s).`);
    } catch (err) {
      console.error('[AppRegistry] fetchInstalledApps error:', err);
    }
  },

  /**
   * installApp(app, supabase)
   * Optimistically adds app to installedApps; persists to DB if live.
   */
  installApp: async (app, supabase) => {
    const { currentUser, fetchInstalledApps, installedApps } = get();
    const appId = app.id ?? app.slug;

    // Avoid duplicate
    if (installedApps.some(a => (a.id ?? a.slug) === appId)) return;

    // Optimistic update
    set(state => ({ installedApps: [...state.installedApps, app] }));

    if (!supabase || !currentUser?.id || currentUser.id === 'mock-user-dev') return;

    try {
      const { error } = await supabase
        .from('user_installed_apps')
        .insert({ user_id: currentUser.id, app_id: app.id });
      if (error && error.code !== '23505') throw error;
      await fetchInstalledApps(supabase, currentUser.id);
    } catch (err) {
      console.error('[AppStore] installApp DB error:', err);
      // Roll back optimistic update
      set(state => ({
        installedApps: state.installedApps.filter(a => (a.id ?? a.slug) !== appId),
      }));
    }
  },

  /**
   * uninstallApp(app, supabase)
   * Removes app from installedApps. Native apps are protected and cannot be uninstalled.
   */
  uninstallApp: async (app, supabase) => {
    if (app.is_native) return; // never uninstall native OS apps

    const { currentUser, fetchInstalledApps } = get();
    const appId = app.id ?? app.slug;

    // Optimistic removal
    set(state => ({
      installedApps: state.installedApps.filter(a => (a.id ?? a.slug) !== appId),
    }));

    if (!supabase || !currentUser?.id || currentUser.id === 'mock-user-dev') return;

    try {
      const { error } = await supabase
        .from('user_installed_apps')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('app_id', app.id);
      if (error) throw error;
      await fetchInstalledApps(supabase, currentUser.id);
    } catch (err) {
      console.error('[AppStore] uninstallApp DB error:', err);
      // Roll back: re-add the app
      set(state => ({ installedApps: [...state.installedApps, app] }));
    }
  },

  /** Direct setter for optimistic UI patterns */
  setInstalledApps: (apps) => set({ installedApps: apps }),
}));

export default useConfigStore;
