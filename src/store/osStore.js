/**
 * osStore.js
 * Central Zustand store for the Virtual OS window management engine.
 * Tracks all open windows and their state, and exposes actions to control them.
 */
import { create } from 'zustand';

// ── App Registry ─────────────────────────────────────────────────────────────
// is_native: true  → ships with the OS, pre-installed for every user
// is_native: false → optional; user must install from the App Store
export const APP_REGISTRY = [
  // ── Native (pre-installed) ───────────────────────────────────────────────
  {
    name: 'System Diagnostic',
    slug: 'system-diagnostic',
    icon_name: 'Monitor',
    developer_name: 'WebOS Core',
    description: 'Real-time hardware stats: CPU, memory, disk, and network at a glance.',
    category: 'Utilities',
    is_native: true,
  },
  {
    name: 'File Explorer',
    slug: 'file-explorer',
    icon_name: 'FolderOpen',
    developer_name: 'WebOS Core',
    description: 'Browse, manage, and organise your virtual file system with ease.',
    category: 'Utilities',
    is_native: true,
  },
  {
    name: 'Terminal',
    slug: 'terminal',
    icon_name: 'Terminal',
    developer_name: 'WebOS Core',
    description: 'Full-featured shell emulator. Run commands, scripts, and more.',
    category: 'Developer',
    is_native: true,
  },
  {
    name: 'Settings',
    slug: 'settings',
    icon_name: 'Settings',
    developer_name: 'WebOS Core',
    description: 'Customise your wallpaper, theme, animations, and display preferences.',
    category: 'Utilities',
    is_native: true,
  },
  {
    name: 'Text Editor',
    slug: 'text-editor',
    icon_name: 'FileText',
    developer_name: 'WebOS Core',
    description: 'Distraction-free writing with Google Drive cloud sync. Save files directly to your Drive.',
    category: 'Productivity',
    is_native: true,
  },
  {
    name: 'Browser',
    slug: 'browser',
    icon_name: 'Globe',
    developer_name: 'WebOS Core',
    description: 'Embedded web browser for quick lookups without leaving the OS.',
    category: 'Utilities',
    is_native: true,
  },
  {
    name: 'App Store',
    slug: 'app-store',
    icon_name: 'Store',
    developer_name: 'WebOS Core',
    description: 'Discover, install, and manage apps for your Virtual OS.',
    category: 'Utilities',
    is_native: true,
  },

  // ── Installable (optional) ───────────────────────────────────────────────
  {
    name: 'Calendar',
    slug: 'calendar',
    icon_name: 'Calendar',
    developer_name: 'WebOS Labs',
    description: 'A clean monthly calendar with event tracking, reminders, and today highlights.',
    category: 'Productivity',
    is_native: false,
  },
  {
    name: 'Notes',
    slug: 'notes',
    icon_name: 'BookOpen',
    developer_name: 'WebOS Labs',
    description: 'Quick-capture sticky notes. Colour-code, pin, and search your thoughts instantly.',
    category: 'Productivity',
    is_native: false,
  },
  {
    name: 'Calculator',
    slug: 'calculator',
    icon_name: 'BarChart2',
    developer_name: 'WebOS Labs',
    description: 'Scientific calculator with history log, unit conversions, and formula memory.',
    category: 'Utilities',
    is_native: false,
  },
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
