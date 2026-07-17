/**
 * SettingsApp.jsx
 * Ubuntu-inspired system settings application.
 * Left sidebar navigation + right scrollable content panel.
 *
 * Appearance tab:
 *  - Built-in wallpapers (Unsplash)
 *  - Drive wallpapers: upload from local → WebOS_Data/wallpaper/, list all,
 *    click to apply as desktop background (uses getDriveFileBlob for private files)
 *  - Custom URL input
 *  - Theme toggle, animation toggle, sidebar toggle
 *
 * All changes persist via supabase.from('user_configs').upsert().
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Monitor, Volume2, Wifi, User, Info,
  Check, ChevronRight, Sun, Moon, Zap, ZapOff, Image,
  Upload, RefreshCw, Loader2, AlertCircle, CloudOff,
} from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';
import useConfigStore from '../store/configStore';
import supabase from '../lib/supabaseClient';
import { listDriveFolder, uploadFileToDrive, getDriveFileBlob } from '../lib/driveService';

// ── Curated built-in wallpapers ───────────────────────────────────────────────
const WALLPAPERS = [
  {
    label: 'Nebula',
    url:   'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=320&q=70',
  },
  {
    label: 'Aurora',
    url:   'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=320&q=70',
  },
  {
    label: 'Deep Space',
    url:   'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=320&q=70',
  },
  {
    label: 'Lava',
    url:   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&q=70',
  },
  {
    label: 'Forest',
    url:   'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=320&q=70',
  },
  {
    label: 'Minimal',
    url:   'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=320&q=70',
  },
];

// ── Sidebar nav items ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'appearance', label: 'Appearance',     icon: Palette  },
  { id: 'display',    label: 'Display',         icon: Monitor  },
  { id: 'sound',      label: 'Sound',           icon: Volume2  },
  { id: 'network',    label: 'Network',         icon: Wifi     },
  { id: 'users',      label: 'Users & Privacy', icon: User     },
  { id: 'about',      label: 'About',           icon: Info     },
];

// ── Toggle switch ─────────────────────────────────────────────────────────────
const ToggleSwitch = ({ enabled, onChange }) => (
  <motion.button
    onClick={() => onChange(!enabled)}
    className="relative flex-shrink-0"
    style={{
      width: 44, height: 24, borderRadius: 12,
      background: enabled
        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
        : 'rgba(255,255,255,0.12)',
      border: '1px solid rgba(255,255,255,0.1)',
      cursor: 'pointer', transition: 'background 0.2s',
    }}
    aria-checked={enabled}
    role="switch"
  >
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      style={{
        position: 'absolute', top: 3,
        left: enabled ? 22 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }}
    />
  </motion.button>
);

// ── Section header ────────────────────────────────────────────────────────────
const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-5">
    <h2 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</h2>
    {subtitle && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{subtitle}</p>}
  </div>
);

// ── Setting row ───────────────────────────────────────────────────────────────
const SettingRow = ({ label, description, control }) => (
  <div
    className="flex items-center justify-between gap-6 p-5 rounded-xl"
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
  >
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.88)' }}>{label}</div>
      {description && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{description}</div>}
    </div>
    <div className="flex-shrink-0">{control}</div>
  </div>
);

// ── Placeholder tab ───────────────────────────────────────────────────────────
const PlaceholderTab = ({ label }) => (
  <div className="flex flex-col items-center justify-center h-64 gap-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
    <div className="text-4xl">🚧</div>
    <div className="text-sm font-medium">{label} settings coming soon</div>
  </div>
);

// ── Wallpaper thumbnail card ──────────────────────────────────────────────────
const WallpaperCard = ({ src, label, isActive, onClick, badge }) => (
  <motion.button
    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="relative rounded-xl overflow-hidden group flex-shrink-0"
    style={{
      aspectRatio: '16/9',
      background: 'rgba(255,255,255,0.06)',
      border: isActive ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.08)',
      boxShadow: isActive ? '0 0 0 3px rgba(99,102,241,0.3)' : 'none',
    }}
  >
    <img src={src} alt={label} className="w-full h-full object-cover" loading="lazy"
      onError={e => { e.currentTarget.style.opacity = '0'; }} />
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1"
      style={{ background: 'rgba(0,0,0,0.45)' }}>
      <span className="text-xs font-medium text-white truncate max-w-[90%]">{label}</span>
      <span className="text-[10px] text-white/50">Click to apply</span>
    </div>
    {isActive && (
      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: '#6366f1' }}>
        <Check size={11} className="text-white" strokeWidth={3} />
      </div>
    )}
    {badge && (
      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
        style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.6)' }}>
        {badge}
      </div>
    )}
  </motion.button>
);

// ── Appearance tab ────────────────────────────────────────────────────────────
const AppearanceTab = ({ userPrefs, onUpdate }) => {
  const [customUrl,       setCustomUrl]       = useState(userPrefs.wallpaper_url || '');
  const [driveWallpapers, setDriveWallpapers] = useState([]);
  const [driveLoading,    setDriveLoading]    = useState(false);
  const [driveError,      setDriveError]      = useState(null);
  const [uploading,       setUploading]       = useState(false);
  const fileInputRef = useRef(null);

  // Load Drive wallpapers on mount
  useEffect(() => { loadDriveWallpapers(); }, []);

  const loadDriveWallpapers = async () => {
    if (!supabase) return;
    setDriveLoading(true);
    setDriveError(null);
    try {
      const files = await listDriveFolder('wallpaper');
      setDriveWallpapers(
        files.filter(f =>
          f.mimeType?.startsWith('image/') ||
          /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(f.name)
        )
      );
    } catch (err) {
      setDriveError(err.message);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(true);
    setDriveError(null);
    try {
      await uploadFileToDrive(file, 'wallpaper');
      await loadDriveWallpapers(); // auto-refresh gallery
    } catch (err) {
      setDriveError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Drive files are private — fetch with Bearer token → blob URL
  const applyDriveWallpaper = async (file) => {
    if (!supabase) return;
    setDriveError(null);
    try {
      const blobUrl = await getDriveFileBlob(file.id);
      onUpdate({ wallpaper_url: blobUrl });
    } catch (err) {
      setDriveError(`Cannot load: ${err.message}`);
    }
  };

  const applyCustomUrl = () => {
    if (customUrl.trim()) onUpdate({ wallpaper_url: customUrl.trim() });
  };

  return (
    <div className="space-y-10">

      {/* ── Built-in Wallpapers ── */}
      <div>
        <SectionHeader title="Wallpaper" subtitle="Choose a background for your desktop" />
        <div className="grid grid-cols-3 gap-4 mb-5">
          {WALLPAPERS.map(wp => (
            <WallpaperCard
              key={wp.url}
              src={wp.thumb}
              label={wp.label}
              isActive={userPrefs.wallpaper_url === wp.url}
              onClick={() => onUpdate({ wallpaper_url: wp.url })}
            />
          ))}
        </div>

        {/* Custom URL */}
        <div className="flex gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Image size={15} style={{ color: 'rgba(255,255,255,0.35)', marginTop: 2, flexShrink: 0 }} />
          <div className="flex-1 flex gap-3">
            <input
              type="url"
              placeholder="Paste a custom image URL…"
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyCustomUrl()}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/20"
              style={{ color: 'rgba(255,255,255,0.85)', minWidth: 0 }}
            />
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={applyCustomUrl}
              className="text-xs px-4 py-1.5 rounded-lg font-medium flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}>
              Apply
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── My Wallpapers (Drive) ── */}
      <div>
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              My Wallpapers
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Drive · WebOS_Data/wallpaper/ — also shows files added via Google Drive app
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.95 }}
              onClick={loadDriveWallpapers}
              disabled={driveLoading}
              className="p-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              title="Refresh gallery"
            >
              <RefreshCw size={13}
                className={driveLoading ? 'animate-spin' : ''}
                style={{ color: 'rgba(255,255,255,0.5)' }}
              />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !supabase}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: supabase ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.08)',
                color: 'white',
                boxShadow: supabase ? '0 4px 16px rgba(99,102,241,0.3)' : 'none',
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </motion.button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        {/* Error */}
        {driveError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 mb-4 rounded-xl text-xs"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
          >
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            {driveError}
          </motion.div>
        )}

        {/* Gallery states */}
        {!supabase ? (
          <div className="flex items-center gap-3 p-5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <CloudOff size={16} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Sign in with Google to upload and use your own wallpapers from Drive.
            </p>
          </div>
        ) : driveLoading ? (
          <div className="flex items-center justify-center h-32 gap-3">
            <Loader2 size={18} className="animate-spin" style={{ color: '#818cf8' }} />
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading from Drive…</span>
          </div>
        ) : driveWallpapers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-4 py-12 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.08)' }}
          >
            <ImageIcon size={36} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>No wallpapers yet</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Upload images or add files via the Google Drive app to WebOS_Data/wallpaper/
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              <Upload size={12} />Upload your first wallpaper
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {driveWallpapers.map(f => (
              <WallpaperCard
                key={f.id}
                src={`https://drive.google.com/thumbnail?id=${f.id}&sz=w400`}
                label={f.name.replace(/\.[^.]+$/, '')}
                isActive={userPrefs.wallpaper_url && userPrefs.wallpaper_url.includes(f.id)}
                onClick={() => applyDriveWallpaper(f)}
                badge="Drive"
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Theme & Style ── */}
      <div>
        <SectionHeader title="Style" subtitle="Personalise the look of Virtual OS" />
        <div className="space-y-3">
          {/* Theme selector */}
          <div className="p-5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.88)' }}>
              Interface Theme
            </div>
            <div className="flex gap-3">
              {[
                { value: 'dark',  label: 'Dark',  icon: Moon, accent: '#6366f1' },
                { value: 'light', label: 'Light', icon: Sun,  accent: '#f59e0b' },
              ].map(opt => {
                const Icon = opt.icon;
                const active = userPrefs.theme === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => onUpdate({ theme: opt.value })}
                    className="flex-1 flex flex-col items-center gap-2.5 py-5 px-4 rounded-xl"
                    style={{
                      background: active ? `${opt.accent}22` : 'rgba(255,255,255,0.03)',
                      border: active ? `2px solid ${opt.accent}` : '2px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <Icon size={22} style={{ color: active ? opt.accent : 'rgba(255,255,255,0.4)' }} />
                    <span className="text-xs font-medium"
                      style={{ color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                      {opt.label}
                    </span>
                    {active && <div className="w-1.5 h-1.5 rounded-full" style={{ background: opt.accent }} />}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <SettingRow
            label="Interface Animations"
            description="Enable smooth transitions and motion effects across the desktop"
            control={
              <ToggleSwitch
                enabled={userPrefs.animations_enabled}
                onChange={val => onUpdate({ animations_enabled: val })}
              />
            }
          />
          <SettingRow
            label="Sidebar Expanded by Default"
            description="Keep the application sidebar open when launching the OS"
            control={
              <ToggleSwitch
                enabled={userPrefs.ubuntu_sidebar_expanded}
                onChange={val => onUpdate({ ubuntu_sidebar_expanded: val })}
              />
            }
          />
        </div>
      </div>
    </div>
  );
};

// ── Main SettingsApp ──────────────────────────────────────────────────────────
const SettingsApp = () => {
  const [activeTab, setActiveTab] = useState('appearance');
  const { userPrefs, updateUserPrefs } = useConfigStore();

  const handleUpdate = async (partial) => {
    // 1. Optimistic update
    updateUserPrefs(partial);

    // 2. Persist to Supabase
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase.from('user_configs').upsert({
        user_id: session.user.id,
        ...useConfigStore.getState().userPrefs,
        ...partial,
      });
    } catch (err) {
      console.error('[Settings] upsert failed:', err);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance': return <AppearanceTab userPrefs={userPrefs} onUpdate={handleUpdate} />;
      default:           return <PlaceholderTab label={NAV_ITEMS.find(n => n.id === activeTab)?.label} />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ color: 'rgba(255,255,255,0.88)' }}>

      {/* ── Sidebar ── */}
      <div
        className="flex-shrink-0 flex flex-col py-6"
        style={{ width: 220, borderRight: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="px-6 mb-6">
          <h1 className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>Settings</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Virtual OS Preferences</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-medium text-left"
                style={{
                  background: isActive ? 'rgba(99,102,241,0.18)' : 'transparent',
                  color: isActive ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                  border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                }}
              >
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.6 }} />}
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* ── Content panel ── */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SettingsApp;
