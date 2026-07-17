/**
 * Taskbar.jsx
 * Windows 11-style bottom-docked taskbar.
 * - Center shortcuts: only shows INSTALLED apps (from configStore.installedSlugs)
 * - Start button: opens a Start Menu popup showing all installed apps in a grid
 * - System Tray: Drive Sync Status icon, clock, network, volume, battery
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, FolderOpen, Terminal, Settings, FileText, Globe,
  Calendar, Video, Headphones, Store,
  Wifi, Volume2, VolumeX, Volume1, Battery, ChevronUp, LayoutGrid,
  Cloud, Loader2, CheckCircle2, AlertTriangle, Package,
  Search, Power, User, Sparkles,
} from 'lucide-react';
import useOSStore, { APP_REGISTRY } from '../store/osStore';
import useConfigStore from '../store/configStore';
import useDriveStore from '../store/driveStore';
import useMediaStore from '../store/mediaStore';
import supabase from '../lib/supabaseClient';

// ── Icon map: icon_name string → Lucide component ─────────────────────────────
const ICON_MAP = {
  Monitor, FolderOpen, Terminal, Settings, FileText, Globe,
  Calendar, Video, Headphones, Store, Package, Sparkles,
};

// ── Volume Control (tray) ───–––––––––––––––––––––––––––––––––––––––––––––
const VolumeControl = () => {
  const { volume, muted, setVolume, toggleMute } = useMediaStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const effectiveVol = muted ? 0 : volume;
  const VolumeIcon = effectiveVol === 0 || muted ? VolumeX
    : effectiveVol < 0.45 ? Volume1
    : Volume2;

  return (
    <div ref={ref} className="relative flex items-center">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(v => !v)}
        onContextMenu={(e) => { e.preventDefault(); toggleMute(); }}
        title={muted ? 'Unmute (right-click to toggle mute)' : `Volume: ${Math.round(volume * 100)}%`}
      >
        <VolumeIcon
          size={15}
          style={{ color: muted ? 'rgba(255,255,255,0.35)' : open ? '#a5b4fc' : 'rgba(255,255,255,0.65)' }}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15, type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute bottom-10 right-0 z-[10000] rounded-2xl p-4"
            style={{
              width: 200,
              background: 'rgba(10,10,22,0.97)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Volume</p>
              <span className="text-xs font-bold tabular-nums" style={{ color: '#a5b4fc' }}>
                {Math.round(effectiveVol * 100)}%
              </span>
            </div>

            {/* Volume arc visualizer */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-20 h-20 flex items-center justify-center">
                {/* SVG arc */}
                <svg className="absolute inset-0" viewBox="0 0 80 80">
                  {/* Track */}
                  <path
                    d="M 10,65 A 34,34 0 1,1 70,65"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {/* Progress */}
                  <path
                    d="M 10,65 A 34,34 0 1,1 70,65"
                    fill="none"
                    stroke="url(#vgrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${effectiveVol * 214} 214`}
                  />
                  <defs>
                    <linearGradient id="vgrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Center icon + % */}
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={toggleMute}
                  className="flex flex-col items-center gap-0.5"
                >
                  <VolumeIcon
                    size={20}
                    style={{ color: muted ? 'rgba(255,255,255,0.3)' : '#a5b4fc' }}
                  />
                  <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {muted ? 'MUTED' : ''}
                  </span>
                </motion.button>
              </div>
            </div>

            {/* Slider */}
            <div className="flex items-center gap-2">
              <VolumeX size={12} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effectiveVol}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: '#818cf8',
                    cursor: 'pointer',
                    height: 4,
                  }}
                />
              </div>
              <Volume2 size={12} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
            </div>

            {/* Quick presets */}
            <div className="flex gap-1.5 mt-3">
              {[0, 25, 50, 75, 100].map(p => (
                <motion.button
                  key={p}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setVolume(p / 100)}
                  className="flex-1 py-1 rounded-lg text-[9px] font-semibold"
                  style={{
                    background: Math.round(effectiveVol * 100) === p
                      ? 'rgba(99,102,241,0.3)'
                      : 'rgba(255,255,255,0.06)',
                    color: Math.round(effectiveVol * 100) === p
                      ? '#a5b4fc'
                      : 'rgba(255,255,255,0.35)',
                    border: Math.round(effectiveVol * 100) === p
                      ? '1px solid rgba(99,102,241,0.4)'
                      : '1px solid transparent',
                  }}
                >
                  {p === 0 ? '🔇' : `${p}%`}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Drive Sync Tray Icon ──────────────────────────────────────────────────────
const DriveSyncIcon = () => {
  const { syncStatus, lastFileName, errorMessage } = useDriveStore();
  const [showTooltip, setShowTooltip] = useState(false);

  const stateConfig = {
    idle: {
      icon:  Cloud,
      color: 'rgba(255,255,255,0.35)',
      spin:  false,
      title: 'Drive Sync — idle',
    },
    syncing: {
      icon:  Loader2,
      color: '#818cf8',
      spin:  true,
      title: 'Uploading to Google Drive…',
    },
    success: {
      icon:  CheckCircle2,
      color: '#4ade80',
      spin:  false,
      title: lastFileName ? `Saved: ${lastFileName}` : 'Save complete',
    },
    error: {
      icon:  AlertTriangle,
      color: '#fbbf24',
      spin:  false,
      title: errorMessage || 'Drive sync failed',
    },
  };

  const cfg  = stateConfig[syncStatus] ?? stateConfig.idle;
  const Icon = cfg.icon;

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={syncStatus}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="flex items-center justify-center"
        >
          <Icon
            size={15}
            style={{ color: cfg.color }}
            className={cfg.spin ? 'animate-spin' : ''}
          />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-8 right-0 z-50 pointer-events-none"
            style={{ whiteSpace: 'nowrap' }}
          >
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(15,15,30,0.95)',
                border: `1px solid ${cfg.color}40`,
                color: cfg.color,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {cfg.title}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {syncStatus === 'error' && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
          style={{ border: '1px solid #fbbf24' }}
        />
      )}
    </div>
  );
};

// ── Live tray clock ───────────────────────────────────────────────────────────
const TrayClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col items-end leading-tight select-none cursor-default">
      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.88)' }}>
        {timeStr}
      </span>
      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {dateStr}
      </span>
    </div>
  );
};

// ── Start Menu ────────────────────────────────────────────────────────────────
const StartMenu = ({ onClose, installedApps, onOpenApp, onLogout }) => {
  const [search, setSearch] = useState('');

  const filtered = installedApps.filter(app =>
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
      className="fixed bottom-14 left-4 z-[9998] rounded-2xl overflow-hidden"
      style={{
        width: 380,
        background: 'rgba(10,10,22,0.97)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      {/* Search bar */}
      <div className="p-4 pb-0">
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Search size={14} style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input
            type="text"
            placeholder="Search apps…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
            style={{ color: 'rgba(255,255,255,0.88)' }}
            autoFocus
          />
        </div>
      </div>

      {/* Apps section */}
      <div className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Installed Apps
        </p>
        {filtered.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>No apps found</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filtered.map(app => {
              const IconComp = ICON_MAP[app.icon_name] ?? Package;
              const colors = {
                'app-store':   '#ec4899',
                'settings':    '#6366f1',
                'system-diagnostic': '#06b6d4',
                'text-editor': '#0ea5e9',
                'file-explorer': '#f59e0b',
                'calendar':    '#10b981',
                'video-player':'#8b5cf6',
                'audio-player':'#ec4899',
                'terminal':    '#22c55e',
                'browser':     '#f97316',
              };
              const color = colors[app.slug] ?? '#6366f1';

              return (
                <motion.button
                  key={app.slug}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { onOpenApp(app.slug); onClose(); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                  >
                    <IconComp size={18} style={{ color }} />
                  </div>
                  <span
                    className="text-[10px] font-medium text-center leading-tight"
                    style={{ color: 'rgba(255,255,255,0.65)' }}
                  >
                    {app.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.25)' }}
          >
            <User size={13} style={{ color: '#a5b4fc' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Virtual OS User
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          title="Sign out of Virtual OS"
        >
          <Power size={11} />
          Sign Out
        </motion.button>
      </div>
    </motion.div>
  );
};

// ── Start button ──────────────────────────────────────────────────────────────
const StartButton = ({ onClick, isActive }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.93 }}
    onClick={onClick}
    className="flex items-center justify-center w-10 h-10 rounded-lg transition-all"
    style={{
      background: isActive ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)',
      border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.1)',
    }}
    title="Start"
  >
    <LayoutGrid size={19} style={{ color: isActive ? '#a5b4fc' : 'rgba(255,255,255,0.85)' }} />
  </motion.button>
);

// ── Individual taskbar app button ─────────────────────────────────────────────
const TaskbarApp = ({ app, isOpen, isMinimized, onClick }) => {
  const IconComponent = ICON_MAP[app.icon_name] ?? Monitor;

  return (
    <motion.div className="relative flex flex-col items-center">
      <motion.button
        whileHover={{ scale: 1.12, y: -3 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150"
        style={{
          background: isOpen && !isMinimized
            ? 'rgba(255,255,255,0.13)'
            : 'rgba(255,255,255,0.05)',
          border: isOpen
            ? '1px solid rgba(255,255,255,0.18)'
            : '1px solid rgba(255,255,255,0.06)',
        }}
        title={app.name}
      >
        <IconComponent
          size={19}
          style={{ color: isOpen ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)' }}
        />
      </motion.button>

      {/* Active indicator dot */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute -bottom-1 w-1 h-1 rounded-full"
            style={{ background: isMinimized ? 'rgba(255,255,255,0.35)' : '#6ee7f7' }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main Taskbar ──────────────────────────────────────────────────────────────
const Taskbar = () => {
  const { windows, openWindow } = useOSStore();
  const { installedSlugs } = useConfigStore();
  const [startOpen, setStartOpen] = useState(false);

  // Only show installed apps in taskbar center
  const installedApps = APP_REGISTRY.filter(app => installedSlugs.has(app.slug));

  // Sign out handler
  const handleLogout = async () => {
    setStartOpen(false);
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Hard reload — clears all Zustand/session state and returns to login screen
    window.location.reload();
  };

  return (
    <>
      {/* ── Start Menu Overlay ── */}
      <AnimatePresence>
        {startOpen && (
          <>
            {/* Click-away backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9997]"
              onClick={() => setStartOpen(false)}
            />
            <StartMenu
              onClose={() => setStartOpen(false)}
              installedApps={installedApps}
              onOpenApp={openWindow}
              onLogout={handleLogout}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Taskbar bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-4"
        style={{
          height: 48,
          zIndex: 9999,
          background: 'rgba(10, 10, 20, 0.82)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* ── Left: Start Button ── */}
        <div className="flex items-center gap-2">
          <StartButton onClick={() => setStartOpen(v => !v)} isActive={startOpen} />
        </div>

        {/* ── Center: Installed App Shortcuts ── */}
        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          {installedApps.map(app => {
            const win = windows.find(w => w.id === app.slug);
            return (
              <TaskbarApp
                key={app.slug}
                app={app}
                isOpen={!!win}
                isMinimized={win?.isMinimized ?? false}
                onClick={() => openWindow(app.slug)}
              />
            );
          })}
        </div>

        {/* ── Right: System Tray ── */}
        <div className="flex items-center gap-3">
          <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.45)' }} />
          <Wifi      size={15} style={{ color: 'rgba(255,255,255,0.65)' }} />
          <VolumeControl />
          <Battery   size={15} style={{ color: 'rgba(255,255,255,0.65)' }} />

          <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.12)' }} />

          <DriveSyncIcon />

          <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.12)' }} />

          <TrayClock />
        </div>
      </div>
    </>
  );
};

export default Taskbar;
