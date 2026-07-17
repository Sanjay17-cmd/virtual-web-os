/**
 * AppStoreApp.jsx
 * Virtual OS App Store — browse, install and uninstall applications.
 * Pre-installed system apps show "Installed" badge with no uninstall option.
 * All other apps show Install/Uninstall buttons that update the global configStore.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Monitor, FolderOpen, Terminal, Settings, FileText, Globe,
  Calendar, Video, Headphones, Check, Download, Trash2, Star,
  Search, Grid3X3, List, Package,
} from 'lucide-react';
import { APP_REGISTRY, SYSTEM_APPS } from '../store/osStore';
import useConfigStore from '../store/configStore';

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP = {
  Store, Monitor, FolderOpen, Terminal, Settings, FileText, Globe,
  Calendar, Video, Headphones, Package,
};

// ── Category accent colors ────────────────────────────────────────────────────
const CATEGORY_COLOR = {
  System:      { bg: '#6366f1', light: '#818cf8' },
  Productivity:{ bg: '#0ea5e9', light: '#38bdf8' },
  Media:       { bg: '#ec4899', light: '#f472b6' },
};

// ── App descriptions/ratings ─────────────────────────────────────────────────
const APP_META = {
  'app-store':        { rating: 5.0, size: 'Built-in', version: '1.0.0' },
  'system-diagnostic':{ rating: 4.8, size: 'Built-in', version: '1.2.0' },
  'settings':         { rating: 4.9, size: 'Built-in', version: '2.0.0' },
  'text-editor':      { rating: 4.7, size: '2.1 MB',   version: '1.3.0' },
  'file-explorer':    { rating: 4.6, size: '3.5 MB',   version: '1.1.0' },
  'calendar':         { rating: 4.8, size: '4.2 MB',   version: '1.0.0' },
  'video-player':     { rating: 4.9, size: '8.7 MB',   version: '2.1.0' },
  'audio-player':     { rating: 4.8, size: '6.3 MB',   version: '1.5.0' },
  'terminal':         { rating: 4.5, size: '1.8 MB',   version: '1.0.0' },
  'browser':          { rating: 4.6, size: '12.4 MB',  version: '1.0.0' },
};

// ── Star rating display ───────────────────────────────────────────────────────
const StarRating = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star
        key={i}
        size={10}
        fill={i <= Math.round(rating) ? '#fbbf24' : 'transparent'}
        style={{ color: i <= Math.round(rating) ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
      />
    ))}
    <span className="ml-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
      {rating.toFixed(1)}
    </span>
  </div>
);

// ── App Card ─────────────────────────────────────────────────────────────────
const AppCard = ({ app, installed, isSystem, onInstall, onUninstall }) => {
  const [loading, setLoading] = useState(false);
  const IconComp = ICON_MAP[app.icon_name] ?? Package;
  const cat = CATEGORY_COLOR[app.category] ?? CATEGORY_COLOR.System;
  const meta = APP_META[app.slug] ?? { rating: 4.5, size: '2 MB', version: '1.0.0' };

  const handleInstall = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // simulate install
    onInstall(app.slug);
    setLoading(false);
  };

  const handleUninstall = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    onUninstall(app.slug);
    setLoading(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      }}
    >
      {/* Card top accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${cat.bg}, ${cat.light})` }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Icon + name row */}
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${cat.bg}cc, ${cat.light}99)` }}
          >
            <IconComp size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {app.name}
            </div>
            <div
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-block mt-0.5"
              style={{
                background: `${cat.bg}22`,
                color: cat.light,
                border: `1px solid ${cat.bg}44`,
              }}
            >
              {app.category}
            </div>
          </div>
          {installed && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <Check size={10} style={{ color: '#4ade80' }} />
              <span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>Installed</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {app.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-3">
          <StarRating rating={meta.rating} />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{meta.size}</span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>v{meta.version}</span>
        </div>

        {/* Action button */}
        <div className="mt-auto pt-1">
          {isSystem ? (
            <div
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              <Check size={12} />
              System App
            </div>
          ) : installed ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleUninstall}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: loading ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: loading ? 'rgba(248,113,113,0.5)' : '#f87171',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  className="w-3 h-3 rounded-full border border-red-400 border-t-transparent"
                />
              ) : (
                <Trash2 size={12} />
              )}
              {loading ? 'Removing…' : 'Uninstall'}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleInstall}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: loading
                  ? `${cat.bg}33`
                  : `linear-gradient(135deg, ${cat.bg}, ${cat.light})`,
                border: `1px solid ${cat.bg}66`,
                color: 'white',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: loading ? 'none' : `0 4px 16px ${cat.bg}44`,
              }}
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  className="w-3 h-3 rounded-full border border-white border-t-transparent"
                />
              ) : (
                <Download size={12} />
              )}
              {loading ? 'Installing…' : 'Install'}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Main AppStoreApp ──────────────────────────────────────────────────────────
const AppStoreApp = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const { installedSlugs, installApp, uninstallApp } = useConfigStore();

  const categories = ['All', 'System', 'Productivity', 'Media'];

  const filtered = APP_REGISTRY.filter(app => {
    const matchSearch = app.name.toLowerCase().includes(search.toLowerCase()) ||
                        app.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || app.category === activeCategory;
    return matchSearch && matchCat;
  });

  const installedCount = APP_REGISTRY.filter(a => installedSlugs.has(a.slug)).length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: 'rgba(255,255,255,0.88)' }}>
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 pt-6 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }}
          >
            <Store size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              App Store
            </h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {installedCount} of {APP_REGISTRY.length} apps installed
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Search size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="text"
            placeholder="Search apps…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/20"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2">
          {categories.map(cat => (
            <motion.button
              key={cat}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveCategory(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeCategory === cat
                  ? 'rgba(99,102,241,0.25)'
                  : 'rgba(255,255,255,0.05)',
                border: activeCategory === cat
                  ? '1px solid rgba(99,102,241,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: activeCategory === cat ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
              }}
            >
              {cat}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── App Grid ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <Package size={40} strokeWidth={1.5} />
            <p className="text-sm">No apps found</p>
          </div>
        ) : (
          <motion.div
            layout
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            <AnimatePresence>
              {filtered.map(app => (
                <AppCard
                  key={app.slug}
                  app={app}
                  installed={installedSlugs.has(app.slug)}
                  isSystem={SYSTEM_APPS.has(app.slug)}
                  onInstall={installApp}
                  onUninstall={uninstallApp}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AppStoreApp;
