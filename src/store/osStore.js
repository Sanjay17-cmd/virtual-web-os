/**
 * osStore.js
 * Central Zustand store for the Virtual OS window management engine.
 * Tracks all open windows and their state, and exposes actions to control them.
 */
import { create } from 'zustand';

// Registry of all available applications, mirroring public.app_registry schema
export const APP_REGISTRY = [
  { name: 'System Diagnostic', slug: 'system-diagnostic', icon_name: 'Monitor' },
  { name: 'File Explorer',     slug: 'file-explorer',     icon_name: 'FolderOpen' },
  { name: 'Terminal',          slug: 'terminal',           icon_name: 'Terminal' },
  { name: 'Settings',          slug: 'settings',           icon_name: 'Settings' },
  { name: 'Text Editor',       slug: 'text-editor',        icon_name: 'FileText' },
  { name: 'Browser',           slug: 'browser',            icon_name: 'Globe' },
];

// Map slugs to their human-readable title
const SLUG_TO_TITLE = Object.fromEntries(APP_REGISTRY.map(a => [a.slug, a.name]));

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
}));

export default useOSStore;
