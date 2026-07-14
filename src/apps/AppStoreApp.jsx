/**
 * AppStoreApp.jsx
 * Virtual OS App Store — redesigned with:
 *  - Native apps shown as pre-installed (with shield badge, no uninstall)
 *  - Installable apps with Install / Uninstall buttons
 *  - Two-section layout: "Built-in Apps" + "Available to Install"
 *  - Real-time state via Zustand configStore
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Search, Download, CheckCircle2, Loader2, Trash2,
  Shield, Monitor, FolderOpen, Terminal, Settings, FileText,
  Globe, Cpu, Wifi, Palette, BarChart2, Code2,
  Music, Camera, Mail, Calendar, Cloud, Lock,
  Gamepad2, Map, ShoppingCart, Video, BookOpen,
  Layers, Zap, Star, Package,
} from 'lucide-react';
import useConfigStore from '../store/configStore';
import supabase from '../lib/supabaseClient';

// ── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP = {
  Monitor, FolderOpen, Terminal, Settings, FileText,
  Globe, Cpu, Wifi, Palette, BarChart2, Code2,
  Music, Camera, Mail, Calendar, Cloud, Lock,
  Gamepad2, Map, ShoppingCart, Video, BookOpen,
  Layers, Zap, Star, Package, Store,
};

// ── Accent colours cycled per-card ───────────────────────────────────────────
const ACCENTS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#3b82f6',
];
const accentFor = (index) => ACCENTS[index % ACCENTS.length];

// ── Individual App Card ───────────────────────────────────────────────────────
const AppCard = ({
  app, index, isInstalled, isInstalling, isUninstalling,
  onInstall, onUninstall,
}) => {
  const Icon    = ICON_MAP[app.icon_name] ?? Package;
  const accent  = accentFor(index);
  const [hovered, setHovered] = useState(false);
  const isNative = !!app.is_native;
  const busy = isInstalling || isUninstalling;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: hovered
          ? `1px solid ${accent}50`
          : '1px solid rgba(255,255,255,0.07)',
        transition: 'background 0.2s, border 0.2s',
      }}
    >
      {/* Icon header */}
      <div
        className="flex items-center justify-center h-24 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accent}22 0%, ${accent}08 100%)`,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Blurred orb */}
        <div
          className="absolute w-20 h-20 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)`,
            filter: 'blur(14px)',
          }}
        />
        <div
          className="relative flex items-center justify-center w-12 h-12 rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${accent}55, ${accent}22)`,
            border: `1px solid ${accent}40`,
            boxShadow: `0 6px 20px ${accent}25`,
          }}
        >
          <Icon size={22} style={{ color: accent }} />
        </div>

        {/* Native shield badge */}
        {isNative && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'rgba(16,185,129,0.18)',
              border: '1px solid rgba(16,185,129,0.35)',
              color: '#34d399',
            }}
          >
            <Shield size={9} />
            Built-in
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-2.5">
        <div>
          <h3
            className="text-sm font-semibold leading-snug"
            style={{ color: 'rgba(255,255,255,0.92)' }}
          >
            {app.name}
          </h3>
          {app.developer_name && (
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>
              {app.developer_name}
            </p>
          )}
        </div>

        {app.description && (
          <p
            className="text-xs leading-relaxed flex-1"
            style={{
              color: 'rgba(255,255,255,0.48)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {app.description}
          </p>
        )}

        {/* Action button area */}
        {isNative ? (
          /* Native — show static "Installed" badge, no action */
          <div
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold"
            style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#6ee7b7',
            }}
          >
            <CheckCircle2 size={12} />
            <span>Pre-installed</span>
          </div>
        ) : isInstalled ? (
          /* Installed — show Uninstall button */
          <motion.button
            whileHover={busy ? {} : { scale: 1.03 }}
            whileTap={busy ? {} : { scale: 0.97 }}
            onClick={() => !busy && onUninstall(app)}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: isUninstalling ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: isUninstalling ? 'rgba(252,165,165,0.5)' : '#fca5a5',
              cursor: busy ? 'wait' : 'pointer',
              opacity: isUninstalling ? 0.7 : 1,
            }}
          >
            {isUninstalling ? (
              <><Loader2 size={12} className="animate-spin" /><span>Removing…</span></>
            ) : (
              <><Trash2 size={12} /><span>Uninstall</span></>
            )}
          </motion.button>
        ) : (
          /* Not installed — show Install button */
          <motion.button
            whileHover={busy ? {} : { scale: 1.03 }}
            whileTap={busy ? {} : { scale: 0.97 }}
            onClick={() => !busy && onInstall(app)}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: `${accent}22`,
              border: `1px solid ${accent}40`,
              color: accent,
              cursor: busy ? 'wait' : 'pointer',
              opacity: isInstalling ? 0.7 : 1,
            }}
          >
            {isInstalling ? (
              <><Loader2 size={12} className="animate-spin" /><span>Installing…</span></>
            ) : (
              <><Download size={12} /><span>Install</span></>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

// ── Section heading ───────────────────────────────────────────────────────────
const SectionHeading = ({ title, count }) => (
  <div className="flex items-center gap-3 mb-4">
    <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
      {title}
    </h2>
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: 'rgba(255,255,255,0.07)',
        color: 'rgba(255,255,255,0.4)',
      }}
    >
      {count}
    </span>
    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
  </div>
);

// ── Main AppStoreApp ──────────────────────────────────────────────────────────
const AppStoreApp = () => {
  const {
    availableApps, installedApps,
    installApp, uninstallApp,
  } = useConfigStore();

  const [search, setSearch] = useState('');
  const [actionState, setActionState] = useState({}); // { [slug]: 'installing' | 'uninstalling' }

  // Build installed slugs Set
  const installedSlugs = new Set(installedApps.map(a => a.slug));

  // Split registry
  const nativeApps      = availableApps.filter(a => a.is_native);
  const installableApps = availableApps.filter(a => !a.is_native);

  // Apply search across both groups
  const q = search.toLowerCase();
  const filterApp = (a) =>
    a.name.toLowerCase().includes(q) ||
    (a.description ?? '').toLowerCase().includes(q) ||
    (a.developer_name ?? '').toLowerCase().includes(q);

  const visibleNative      = nativeApps.filter(filterApp);
  const visibleInstallable = installableApps.filter(filterApp);

  const handleInstall = useCallback(async (app) => {
    const key = app.slug;
    setActionState(s => ({ ...s, [key]: 'installing' }));
    // Simulate 800ms in mock mode; installApp handles both paths
    if (!supabase || useConfigStore.getState().currentUser?.id === 'mock-user-dev') {
      await new Promise(r => setTimeout(r, 800));
    }
    await installApp(app, supabase);
    setActionState(s => ({ ...s, [key]: null }));
  }, [installApp]);

  const handleUninstall = useCallback(async (app) => {
    const key = app.slug;
    setActionState(s => ({ ...s, [key]: 'uninstalling' }));
    if (!supabase || useConfigStore.getState().currentUser?.id === 'mock-user-dev') {
      await new Promise(r => setTimeout(r, 600));
    }
    await uninstallApp(app, supabase);
    setActionState(s => ({ ...s, [key]: null }));
  }, [uninstallApp]);

  const totalInstallable  = installableApps.length;
  const countUserInstalled = installableApps.filter(a => installedSlugs.has(a.slug)).length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: 'rgba(255,255,255,0.88)' }}>

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 pt-5 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Store size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              App Store
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {nativeApps.length} built-in · {countUserInstalled}/{totalInstallable} optional installed
            </p>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <Search size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search apps…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-white/20"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── Section 1: Built-in (native) apps ── */}
        {visibleNative.length > 0 && (
          <section>
            <SectionHeading title="Built-in Apps" count={visibleNative.length} />
            <div className="grid grid-cols-3 gap-5">
              <AnimatePresence>
                {visibleNative.map((app, i) => (
                  <AppCard
                    key={app.slug}
                    app={app}
                    index={i}
                    isInstalled={true}
                    isInstalling={false}
                    isUninstalling={false}
                    onInstall={handleInstall}
                    onUninstall={handleUninstall}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ── Section 2: Optional installable apps ── */}
        {visibleInstallable.length > 0 && (
          <section>
            <SectionHeading title="Available to Install" count={visibleInstallable.length} />
            <div className="grid grid-cols-3 gap-5">
              <AnimatePresence>
                {visibleInstallable.map((app, i) => {
                  const isInstalled   = installedSlugs.has(app.slug);
                  const state         = actionState[app.slug];
                  return (
                    <AppCard
                      key={app.slug}
                      app={app}
                      index={i + visibleNative.length}
                      isInstalled={isInstalled}
                      isInstalling={state === 'installing'}
                      isUninstalling={state === 'uninstalling'}
                      onInstall={handleInstall}
                      onUninstall={handleUninstall}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Empty state */}
        {visibleNative.length === 0 && visibleInstallable.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Store size={30} style={{ color: 'rgba(255,255,255,0.12)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
              No apps match "{search}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppStoreApp;
