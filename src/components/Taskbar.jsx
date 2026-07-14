/**
 * Taskbar.jsx
 * Windows 11-style bottom-docked taskbar.
 * System Tray now includes a Drive Sync Status icon that dynamically
 * reflects the active upload state via useDriveStore:
 *   idle    → cloud icon (dim)
 *   syncing → spinning loader (indigo)
 *   success → check-circle (green, auto-fades after 4s)
 *   error   → alert-triangle (amber, with tooltip)
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, FolderOpen, Terminal, Settings, FileText, Globe,
  Wifi, Volume2, Battery, ChevronUp, LayoutGrid,
  Cloud, Loader2, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import useOSStore from '../store/osStore';
import { APP_REGISTRY } from '../store/osStore';
import useDriveStore from '../store/driveStore';

// ── Icon map: icon_name string → Lucide component ────────────────────────────
const ICON_MAP = {
  Monitor, FolderOpen, Terminal, Settings, FileText, Globe,
};

// ── Drive Sync Tray Icon ─────────────────────────────────────────────────────
const DriveSyncIcon = () => {
  const { syncStatus, lastFileName, errorMessage } = useDriveStore();
  const [showTooltip, setShowTooltip] = useState(false);

  // Visual config per state
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
      {/* Animated icon with state transitions */}
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

      {/* Tooltip */}
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

      {/* Pulse ring for error state */}
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

// ── Start button ──────────────────────────────────────────────────────────────
const StartButton = ({ onClick }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.93 }}
    onClick={onClick}
    className="flex items-center justify-center w-10 h-10 rounded-lg"
    style={{
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}
    title="Start"
  >
    <LayoutGrid size={19} style={{ color: 'rgba(255,255,255,0.85)' }} />
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
  const [startOpen, setStartOpen] = useState(false);

  return (
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
        <StartButton onClick={() => setStartOpen(v => !v)} />
      </div>

      {/* ── Center: App Shortcuts ── */}
      <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
        {APP_REGISTRY.map(app => {
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
        {/* Standard tray icons */}
        <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.45)' }} />
        <Wifi      size={15} style={{ color: 'rgba(255,255,255,0.65)' }} />
        <Volume2   size={15} style={{ color: 'rgba(255,255,255,0.65)' }} />
        <Battery   size={15} style={{ color: 'rgba(255,255,255,0.65)' }} />

        {/* Separator */}
        <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.12)' }} />

        {/* Drive Sync Status icon */}
        <DriveSyncIcon />

        {/* Separator */}
        <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.12)' }} />

        {/* Clock */}
        <TrayClock />
      </div>
    </div>
  );
};

export default Taskbar;
