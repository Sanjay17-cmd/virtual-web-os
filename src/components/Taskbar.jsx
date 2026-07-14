/**
 * Taskbar.jsx
 * Windows 11-style bottom-docked taskbar.
 * App shortcuts are now DYNAMIC — driven by installedApps from configStore.
 * System Tray includes a Drive Sync Status icon with 4 live states.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, FolderOpen, Terminal, Settings, FileText, Globe,
  Wifi, Volume2, Battery, ChevronUp,
  Cloud, Loader2, CheckCircle2, AlertTriangle,
  Store, Cpu, Palette, BarChart2, Code2, Music, Camera,
  Mail, Calendar, Lock, Gamepad2, Map, ShoppingCart,
  Video, BookOpen, Layers, Zap, Star, Package,
} from 'lucide-react';
import useOSStore from '../store/osStore';
import useConfigStore from '../store/configStore';
import useDriveStore from '../store/driveStore';

// ── Comprehensive icon_name → Lucide component map ───────────────────────────
// Must cover every icon_name value that may come from public.app_registry
const ICON_MAP = {
  Monitor, FolderOpen, Terminal, Settings, FileText, Globe,
  Store, Cpu, Palette, BarChart2, Code2, Music, Camera,
  Mail, Calendar, Cloud, Lock, Gamepad2, Map, ShoppingCart,
  Video, BookOpen, Layers, Zap, Star, Package,
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


const TaskbarApp = ({ app, isOpen, isMinimized, onClick }) => {
  // Safely coerce icon_name — DB value may be null/undefined for new app rows
  const iconKey     = typeof app.icon_name === 'string' ? app.icon_name : '';
  const IconComponent = ICON_MAP[iconKey] ?? Package;

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
  // Subscribe to dynamic installed apps — re-renders whenever user installs/removes
  const { installedApps } = useConfigStore();

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
      {/* ── Left: App Store / Start Menu button — permanent, always visible ── */}
      <div className="flex items-center gap-2">
        {/*
          This button is the guaranteed fallback entry point.
          Even with zero installed apps the user can always open the App Store.
        */}
        <motion.button
          id="start-menu-btn"
          whileHover={{ scale: 1.08, y: -1 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => openWindow('app-store')}
          className="flex items-center justify-center w-10 h-10 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.18))',
            border: '1px solid rgba(99,102,241,0.35)',
          }}
          title="App Store"
        >
          <Store size={18} style={{ color: '#a5b4fc' }} />
        </motion.button>
      </div>

      {/* ── Center: Dynamic App Shortcuts (driven by installedApps) ── */}
      <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
        <AnimatePresence>
          {installedApps.map(app => {
            // app.slug is ALWAYS the authoritative key — never fall back to app.id
            // (app.id is the app_registry PK uuid, not a slug string)
            const slug = app.slug;
            if (!slug) return null; // skip any malformed row without a slug
            const win  = windows.find(w => w.id === slug);
            return (
              <motion.div
                key={slug}
                initial={{ opacity: 0, scale: 0.7, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.7, width: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              >
                <TaskbarApp
                  app={app}
                  isOpen={!!win}
                  isMinimized={win?.isMinimized ?? false}
                  onClick={() => openWindow(app.slug)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
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
