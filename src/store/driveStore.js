/**
 * driveStore.js
 * Zustand store for tracking Drive sync state across the OS.
 * Used by the Taskbar system tray icon and the TextEditorApp.
 * State: 'idle' | 'syncing' | 'success' | 'error'
 */
import { create } from 'zustand';

const useDriveStore = create((set) => ({
  // ── State ────────────────────────────────────────────────────────────────
  syncStatus: 'idle',   // 'idle' | 'syncing' | 'success' | 'error'
  lastSynced: null,     // Date or null
  lastFileName: null,   // string or null
  errorMessage: null,   // string or null

  // ── Actions ──────────────────────────────────────────────────────────────
  setSyncing:  ()            => set({ syncStatus: 'syncing', errorMessage: null }),
  setSuccess:  (fileName)    => set({ syncStatus: 'success', lastSynced: new Date(), lastFileName: fileName }),
  setError:    (message)     => set({ syncStatus: 'error',   errorMessage: message }),
  resetStatus: ()            => set({ syncStatus: 'idle',    errorMessage: null }),
}));

export default useDriveStore;
