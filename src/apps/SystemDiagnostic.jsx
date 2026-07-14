/**
 * SystemDiagnostic.jsx
 * Demo application proving that WindowFrame renders, drags, layers,
 * scales, and closes correctly. Reads state from both OS stores.
 * Spacing standardised to p-6/p-8 + gap-6/space-y-6 throughout.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor, Cpu, Wifi, Layers, Palette, CheckCircle2,
} from 'lucide-react';
import useOSStore from '../store/osStore';
import useConfigStore from '../store/configStore';

// ── Mini stat card ────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, accent }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-4 rounded-xl p-5"
    style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
    }}
  >
    <div
      className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
      style={{ background: `${accent}22` }}
    >
      <Icon size={18} style={{ color: accent }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[11px] mb-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.38)' }}>
        {label}
      </div>
      <div className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>
        {value}
      </div>
    </div>
  </motion.div>
);

// ── Animated progress bar ─────────────────────────────────────────────────────
const ProgressBar = ({ label, value, color }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
      <span>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.78)' }}>{value}%</span>
    </div>
    <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <motion.div
        className="h-2 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
      />
    </div>
  </div>
);

// ── Schema field row ──────────────────────────────────────────────────────────
const SchemaRow = ({ column, value, type }) => (
  <div
    className="flex items-center justify-between py-3 px-4 rounded-xl text-xs"
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
  >
    <span style={{ color: '#6ee7f7', fontFamily: 'monospace', minWidth: 180 }}>{column}</span>
    <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: 10 }}>{type}</span>
    <span style={{
      color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace',
      maxWidth: 160, textAlign: 'right', overflow: 'hidden',
      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {String(value)}
    </span>
  </div>
);

// ── Section card wrapper ──────────────────────────────────────────────────────
const SectionCard = ({ title, children }) => (
  <div
    className="rounded-2xl p-6"
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
  >
    <div className="text-xs font-semibold mb-5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
      {title}
    </div>
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const SystemDiagnostic = () => {
  const { windows, highestZIndex } = useOSStore();
  const { userPrefs, installedApps } = useConfigStore();

  const [cpuUsage]  = useState(() => Math.floor(Math.random() * 40) + 15);
  const [memUsage]  = useState(() => Math.floor(Math.random() * 35) + 30);
  const [diskUsage] = useState(() => Math.floor(Math.random() * 50) + 20);

  const openWindows = windows.filter(w => !w.isMinimized).length;

  const [uptime, setUptime] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formatUptime = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="h-full overflow-y-auto p-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="flex items-center justify-center w-11 h-11 rounded-2xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <Monitor size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            System Diagnostic
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Virtual OS v1.0.0 — Runtime Health Check
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
          <span className="text-xs font-medium" style={{ color: '#22c55e' }}>Online</span>
        </div>
      </div>

      {/* ── Main content: space-y-6 sections ── */}
      <div className="space-y-6">

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={Layers}  label="Open Windows"   value={openWindows}          accent="#6ee7f7" />
          <StatCard icon={Cpu}     label="Top Z-Index"    value={highestZIndex}         accent="#a78bfa" />
          <StatCard icon={Wifi}    label="Session Uptime" value={formatUptime(uptime)}  accent="#34d399" />
          <StatCard icon={Palette} label="Active Theme"   value={userPrefs.theme}       accent="#f472b6" />
        </div>

        {/* Performance */}
        <SectionCard title="Simulated Performance">
          <div className="space-y-5">
            <ProgressBar label="CPU"  value={cpuUsage}  color="linear-gradient(90deg, #6366f1, #8b5cf6)" />
            <ProgressBar label="RAM"  value={memUsage}  color="linear-gradient(90deg, #06b6d4, #6ee7f7)" />
            <ProgressBar label="Disk" value={diskUsage} color="linear-gradient(90deg, #10b981, #34d399)" />
          </div>
        </SectionCard>

        {/* user_configs schema */}
        <SectionCard title="public.user_configs — Live State">
          <div className="space-y-2">
            <SchemaRow column="theme"                   value={userPrefs.theme}                    type="text" />
            <SchemaRow column="animations_enabled"      value={userPrefs.animations_enabled}       type="bool" />
            <SchemaRow column="wallpaper_url"           value={userPrefs.wallpaper_url || '(none)'} type="text" />
            <SchemaRow column="ubuntu_sidebar_expanded" value={userPrefs.ubuntu_sidebar_expanded}  type="bool" />
          </div>
        </SectionCard>

        {/* app_registry */}
        <SectionCard title={`public.app_registry — Installed Apps (${installedApps.length})`}>
          <div className="space-y-2">
            {installedApps.map(app => (
              <div
                key={app.slug}
                className="flex items-center gap-4 py-3 px-4 rounded-xl text-xs"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <CheckCircle2 size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', minWidth: 130 }}>{app.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}>{app.slug}</span>
                <span style={{ color: '#6ee7f7', fontFamily: 'monospace', marginLeft: 'auto' }}>{app.icon_name}</span>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>
    </div>
  );
};

export default SystemDiagnostic;
