/**
 * osStore.js
 * Central Zustand store for the Virtual OS window management engine.
 * Tracks all open windows and their state, and exposes actions to control them.
 */
import { create } from 'zustand';

// Registry of all available applications, mirroring public.app_registry schema
export const APP_REGISTRY = [
  { name: 'App Store',      slug: 'app-store',        icon_name: 'Store',      description: 'Browse and install apps for your Virtual OS',                    category: 'System'       },
  { name: 'System Diagnostic', slug: 'system-diagnostic', icon_name: 'Monitor',    description: 'Monitor system health, CPU, memory and processes',               category: 'System'       },
  { name: 'Settings',       slug: 'settings',         icon_name: 'Settings',   description: 'Customize your Virtual OS appearance and preferences',           category: 'System'       },
  { name: 'Text Editor',    slug: 'text-editor',      icon_name: 'FileText',   description: 'Write and edit text files saved to your cloud drive',            category: 'Productivity' },
  { name: 'File Explorer',  slug: 'file-explorer',    icon_name: 'FolderOpen', description: 'Browse, upload and manage files in your drive storage',          category: 'System'       },
  { name: 'Calendar',       slug: 'calendar',         icon_name: 'Calendar',   description: 'Manage your schedule and events with a beautiful calendar',      category: 'Productivity' },
  { name: 'Video Player',   slug: 'video-player',     icon_name: 'Video',      description: 'Play videos from your local system with full controls',          category: 'Media'        },
  { name: 'Audio Player',   slug: 'audio-player',     icon_name: 'Headphones', description: 'Listen to music and audio files from Drive or local disk',       category: 'Media'        },
  { name: 'Terminal',       slug: 'terminal',         icon_name: 'Terminal',   description: 'Command-line interface for advanced operations',                  category: 'System'       },
  { name: 'Browser',        slug: 'browser',          icon_name: 'Globe',      description: 'Browse the web from within your Virtual OS',                     category: 'Productivity' },
  { name: 'Gemini AI',      slug: 'gemini-ai',        icon_name: 'Sparkles',   description: 'Chat with Google Gemini AI. API key stored securely in Supabase.', category: 'Productivity' },
];

// Apps that are pre-installed and cannot be uninstalled
export const SYSTEM_APPS = new Set(['app-store', 'settings', 'system-diagnostic', 'text-editor']);

// Map slugs to their human-readable title
export const SLUG_TO_TITLE = Object.fromEntries(APP_REGISTRY.map(a => [a.slug, a.name]));

const useOSStore = create((set, get) => ({
  // ─── State ───────────────────────────────────────────────────────────────
  windows: [],
  highestZIndex: 10,

  // ─── Actions ─────────────────────────────────────────────────────────────

  /**
   * Opens a window by slug. If already open but minimized, restores it.
   * If already open and visible, focuses it.
   */
  openWindow: (slug) => {
    const { windows, highestZIndex, focusWindow } = get();
    const existing = windows.find(w => w.id === slug);

    if (existing) {
      // Already open — restore if minimized, then focus
      set(state => ({
        windows: state.windows.map(w =>
          w.id === slug ? { ...w, isMinimized: false } : w
        ),
      }));
      focusWindow(slug);
      return;
    }

    const newZIndex = highestZIndex + 1;
    set(state => ({
      highestZIndex: newZIndex,
      windows: [
        ...state.windows,
        {
          id: slug,
          title: SLUG_TO_TITLE[slug] ?? slug,
          isOpen: true,
          isMinimized: false,
          isMaximized: false,
          zIndex: newZIndex,
          componentName: slug,
        },
      ],
    }));
  },

  /** Fully closes and removes the window from state */
  closeWindow: (slug) => {
    set(state => ({
      windows: state.windows.filter(w => w.id !== slug),
    }));
  },

  /** Toggles the minimized state of a window */
  minimizeWindow: (slug) => {
    set(state => ({
      windows: state.windows.map(w =>
        w.id === slug ? { ...w, isMinimized: !w.isMinimized } : w
      ),
    }));
  },

  /** Toggles the maximized state of a window */
  maximizeWindow: (slug) => {
    set(state => ({
      windows: state.windows.map(w =>
        w.id === slug ? { ...w, isMaximized: !w.isMaximized } : w
      ),
    }));
  },

  /**
   * Brings a window to the front by assigning it the highest z-index.
   * Increments the global highestZIndex counter.
   */
  focusWindow: (slug) => {
    const newZIndex = get().highestZIndex + 1;
    set(state => ({
      highestZIndex: newZIndex,
      windows: state.windows.map(w =>
        w.id === slug ? { ...w, zIndex: newZIndex } : w
      ),
    }));
  },

  /**
   * tileWindow(slug, layoutId)
   * Snaps the window to a predefined tile layout.
   * Pass null layoutId to return to floating mode.
   */
  tileWindow: (slug, layoutId) => {
    set(state => ({
      windows: state.windows.map(w =>
        w.id === slug
          ? { ...w, tileLayout: layoutId, isMaximized: false }
          : w
      ),
    }));
  },
}));

export default useOSStore;
