/**
 * mediaStore.js
 * Global media volume/mute state for Virtual OS.
 * Shared between the Taskbar volume control and all audio/video player apps.
 * Volume persists in sessionStorage so it survives hot-reloads during dev.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'virtualos_volume';

const getSavedVolume = () => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved !== null) return parseFloat(saved);
  } catch { /* ignore */ }
  return 0.8;
};

const useMediaStore = create((set, get) => ({
  // ─── State ─────────────────────────────────────────────────────────────────
  volume: getSavedVolume(), // 0.0 – 1.0
  muted:  false,

  // ─── Actions ───────────────────────────────────────────────────────────────

  /** Set volume (0.0 – 1.0). Automatically unmutes if vol > 0. */
  setVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    try { sessionStorage.setItem(STORAGE_KEY, clamped); } catch { /* ignore */ }
    set({ volume: clamped, muted: clamped === 0 });
  },

  /** Toggle mute without changing the underlying volume level. */
  toggleMute: () => set(state => ({ muted: !state.muted })),

  /** Set mute explicitly. */
  setMuted: (m) => set({ muted: m }),

  /** Effective volume (0 when muted). Use this in audio/video element. */
  effectiveVolume: () => {
    const { volume, muted } = get();
    return muted ? 0 : volume;
  },
}));

export default useMediaStore;
