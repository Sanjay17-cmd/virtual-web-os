/**
 * VideoPlayerApp.jsx
 * Local-file video player for Virtual OS.
 *
 * Why local files? Google Drive's authenticated files cannot be streamed
 * directly into <video src="..."> — they require a full fetch with Bearer token
 * which loads the entire file into memory (impractical for large videos).
 * Local files work instantly via createObjectURL().
 *
 * Supported formats (HTML5 native):
 *   ✅ .mp4  (H.264 / H.265)  — best cross-browser support
 *   ✅ .webm (VP8 / VP9 / AV1) — Chrome, Firefox, Edge
 *   ✅ .ogv  (Theora)          — Chrome, Firefox
 *   ⚠️ .mov  (QuickTime)       — Safari, some Chrome builds
 *   ❌ .avi / .mkv / .flv      — NOT natively supported in any browser
 *
 * Features: playlist, play/pause, seek bar with buffered preview,
 * volume, mute, playback speed, fullscreen, keyboard shortcuts.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  SkipBack, SkipForward, ChevronDown, Film, FolderOpen,
  Trash2, Plus, Info,
} from 'lucide-react';
import useMediaStore from '../store/mediaStore';

// ── Time formatter ────────────────────────────────────────────────────────────
const fmtTime = (secs) => {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ── Speed Selector ────────────────────────────────────────────────────────────
const SpeedSelector = ({ speed, onChange }) => {
  const [open, setOpen] = useState(false);
  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold select-none"
        style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
      >
        {speed}×<ChevronDown size={9} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-8 left-0 rounded-xl overflow-hidden z-20"
            style={{
              background: 'rgba(10,10,22,0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              minWidth: 76,
            }}
          >
            {speeds.map(s => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className="w-full px-3 py-1.5 text-xs text-left transition-colors"
                style={{
                  background: speed === s ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: speed === s ? '#a5b4fc' : 'rgba(255,255,255,0.65)',
                }}
              >
                {s}×
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Format info badge ─────────────────────────────────────────────────────────
const SupportedFormats = () => (
  <motion.div
    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
    className="flex flex-wrap gap-1.5 justify-center"
  >
    {[
      { ext: 'MP4', note: 'Best support', good: true },
      { ext: 'WebM', note: 'Chrome/Firefox', good: true },
      { ext: 'OGV', note: 'Chrome/Firefox', good: true },
      { ext: 'MOV', note: 'Safari only', good: false },
      { ext: 'AVI', note: 'Not supported', good: false },
      { ext: 'MKV', note: 'Not supported', good: false },
    ].map(f => (
      <span
        key={f.ext}
        title={f.note}
        className="text-[10px] font-mono px-2 py-0.5 rounded-md"
        style={{
          background: f.good ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${f.good ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`,
          color: f.good ? '#4ade80' : '#f87171',
        }}
      >
        {f.ext}
      </span>
    ))}
  </motion.div>
);

// ── Main VideoPlayerApp ───────────────────────────────────────────────────────
const VideoPlayerApp = () => {
  // ── Playlist state (local File objects + object URLs) ──────────────────────
  const [playlist,    setPlaylist]    = useState([]); // [{name, url, size}]
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [buffered,    setBuffered]    = useState(0);
  const [speed,       setSpeed]       = useState(1);
  const [fullscreen,  setFullscreen]  = useState(false);
  const [showControls,setShowControls]= useState(true);
  const [showInfo,    setShowInfo]    = useState(false);

  // Global volume from mediaStore
  const { volume, muted, setVolume, toggleMute, effectiveVolume } = useMediaStore();

  const videoRef     = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const hideTimer    = useRef(null);

  // ── Sync global volume to video element ───────────────────────────────────
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume       = effectiveVolume();
      videoRef.current.playbackRate = speed;
    }
  }, [volume, muted, speed, effectiveVolume]);

  // ── Cleanup object URLs on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      playlist.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, []); // eslint-disable-line

  // ── Handle file input selection ───────────────────────────────────────────
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newEntries = files.map(f => ({
      id:   `${f.name}-${f.size}`,
      name: f.name,
      url:  URL.createObjectURL(f),
      size: f.size,
      type: f.type,
    }));

    setPlaylist(prev => {
      // Revoke old URLs if replacing everything
      return [...prev, ...newEntries];
    });

    // Auto-play first added file
    if (playlist.length === 0) setCurrentIdx(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFromPlaylist = (idx) => {
    setPlaylist(prev => {
      URL.revokeObjectURL(prev[idx].url);
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    if (currentIdx >= idx && currentIdx > 0) {
      setCurrentIdx(i => i - 1);
    }
  };

  // ── Video event handlers ──────────────────────────────────────────────────
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
  };
  const handlePlay    = () => setPlaying(true);
  const handlePause   = () => setPlaying(false);
  const handleLoaded  = () => { setDuration(videoRef.current?.duration ?? 0); setCurrentTime(0); };
  const handleEnded   = () => {
    if (currentIdx < playlist.length - 1) {
      setCurrentIdx(i => i + 1);
      setPlaying(false);
      setCurrentTime(0);
    } else setPlaying(false);
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !playlist.length) return;
    if (playing) v.pause(); else v.play();
  }, [playing, playlist.length]);

  const seek = (val) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = parseFloat(val);
    setCurrentTime(v.currentTime);
  };

  const skipBy = (secs) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + secs));
  };

  const selectTrack = (idx) => {
    setCurrentIdx(idx);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  // Auto-hide controls in fullscreen
  const bringControlsUp = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2800);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': skipBy(-5); break;
        case 'ArrowRight': skipBy(5); break;
        case 'ArrowUp': setVolume(Math.min(1, volume + 0.1)); break;
        case 'ArrowDown': setVolume(Math.max(0, volume - 0.1)); break;
        case 'KeyM': toggleMute(); break;
        case 'KeyF': toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, volume, skipBy]); // eslint-disable-line

  const pct         = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const current     = playlist[currentIdx];

  // ── Empty state ───────────────────────────────────────────────────────────
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #6366f133, #8b5cf633)', border: '1px solid rgba(99,102,241,0.25)' }}
      >
        <Film size={36} strokeWidth={1.5} style={{ color: '#818cf8' }} />
      </motion.div>
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
          No Video Loaded
        </p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Click "Open File" to browse videos from your computer
        </p>
      </div>
      <motion.button
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
        }}
      >
        <FolderOpen size={16} />
        Open File
      </motion.button>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Supported Formats
        </p>
        <SupportedFormats />
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden bg-black" style={{ color: 'rgba(255,255,255,0.88)' }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv,.mov,.mkv"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Video area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Player container */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-black overflow-hidden"
          onMouseMove={bringControlsUp}
          style={{ cursor: fullscreen && !showControls ? 'none' : 'default' }}
        >
          {/* Video element */}
          {current ? (
            <video
              ref={videoRef}
              key={current.url}   // Force re-mount when track changes
              src={current.url}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onLoadedMetadata={handleLoaded}
              onClick={togglePlay}
              style={{ cursor: 'pointer' }}
            />
          ) : (
            <EmptyState />
          )}

          {/* Center play/pause flash */}
          <AnimatePresence>
            {current && !playing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
                >
                  <Play size={28} className="text-white ml-1" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls overlay */}
          <AnimatePresence>
            {current && (showControls || !playing) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-12"
                onClick={e => e.stopPropagation()}
                style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.88))' }}
              >
                {/* Title */}
                <p className="text-xs mb-2 truncate font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {current.name}
                </p>

                {/* Seek bar */}
                <div
                  className="relative w-full h-1.5 rounded-full mb-3 cursor-pointer group/seek"
                  style={{ background: 'rgba(255,255,255,0.18)' }}
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    seek(((e.clientX - rect.left) / rect.width) * duration);
                  }}
                >
                  {/* Buffered */}
                  <div
                    className="absolute top-0 left-0 h-full rounded-full"
                    style={{ width: `${bufferedPct}%`, background: 'rgba(255,255,255,0.25)' }}
                  />
                  {/* Progress */}
                  <div
                    className="absolute top-0 left-0 h-full rounded-full"
                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #a78bfa)' }}
                  />
                  {/* Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/seek:opacity-100 transition-opacity"
                    style={{ left: `calc(${pct}% - 7px)`, boxShadow: '0 0 0 3px rgba(99,102,241,0.5)' }}
                  />
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} onClick={() => skipBy(-10)}>
                    <SkipBack size={16} style={{ color: 'rgba(255,255,255,0.8)' }} />
                  </motion.button>

                  <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} onClick={togglePlay}>
                    {playing
                      ? <Pause size={22} className="text-white" fill="white" />
                      : <Play  size={22} className="text-white" fill="white" />
                    }
                  </motion.button>

                  <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} onClick={() => skipBy(10)}>
                    <SkipForward size={16} style={{ color: 'rgba(255,255,255,0.8)' }} />
                  </motion.button>

                  {/* Time */}
                  <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {fmtTime(currentTime)} / {fmtTime(duration)}
                  </span>

                  <div className="flex-1" />

                  {/* Volume */}
                  <motion.button whileHover={{ scale: 1.1 }} onClick={toggleMute}>
                    {muted || volume === 0
                      ? <VolumeX size={16} style={{ color: 'rgba(255,255,255,0.65)' }} />
                      : <Volume2 size={16} style={{ color: 'rgba(255,255,255,0.65)' }} />
                    }
                  </motion.button>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={muted ? 0 : volume}
                    onChange={e => setVolume(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-400"
                    style={{ cursor: 'pointer' }}
                    onClick={e => e.stopPropagation()}
                  />

                  <SpeedSelector speed={speed} onChange={setSpeed} />

                  {/* Open more files */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    onClick={() => fileInputRef.current?.click()}
                    title="Add more videos"
                  >
                    <Plus size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </motion.button>

                  {/* Info toggle */}
                  <motion.button whileHover={{ scale: 1.1 }} onClick={() => setShowInfo(v => !v)}>
                    <Info size={15} style={{ color: showInfo ? '#a5b4fc' : 'rgba(255,255,255,0.5)' }} />
                  </motion.button>

                  {/* Fullscreen */}
                  <motion.button whileHover={{ scale: 1.1 }} onClick={toggleFullscreen}>
                    {fullscreen
                      ? <Minimize2 size={15} style={{ color: 'rgba(255,255,255,0.65)' }} />
                      : <Maximize2 size={15} style={{ color: 'rgba(255,255,255,0.65)' }} />
                    }
                  </motion.button>
                </div>

                {/* Keyboard hint */}
                <AnimatePresence>
                  {showInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 grid grid-cols-4 gap-1.5 text-[10px]"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      {[
                        ['Space', 'Play/Pause'], ['←/→', '±5 seconds'],
                        ['↑/↓', 'Volume ±10%'], ['M', 'Mute'],
                        ['F', 'Fullscreen'], ['', ''],
                      ].map(([key, action]) => key ? (
                        <div key={key} className="flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                            style={{ background: 'rgba(255,255,255,0.12)' }}>{key}</kbd>
                          <span>{action}</span>
                        </div>
                      ) : null)}
                      <div className="col-span-4 mt-1">
                        <SupportedFormats />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Track name bar (below video) */}
        {current && (
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 py-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.35)' }}
          >
            <Video size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span className="text-xs font-medium flex-1 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {current.name}
            </span>
            <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {currentIdx + 1} / {playlist.length}
            </span>
          </div>
        )}
      </div>

      {/* ── Playlist sidebar ── */}
      <div
        className="flex-shrink-0 w-52 flex flex-col overflow-hidden"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)' }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Playlist · {playlist.length}
          </p>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
            title="Add video files"
          >
            <Plus size={12} />
            Add
          </motion.button>
        </div>

        {/* Playlist items */}
        <div className="flex-1 overflow-y-auto py-2">
          {playlist.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              <Film size={28} strokeWidth={1.5} />
              <p className="text-xs">Add video files to the playlist</p>
            </div>
          ) : (
            playlist.map((item, i) => (
              <motion.div
                key={item.id}
                whileHover={{ x: 2 }}
                className="flex items-center gap-2 px-3 py-2 group"
                style={{
                  background: i === currentIdx ? 'rgba(99,102,241,0.12)' : 'transparent',
                  borderLeft: i === currentIdx ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'pointer',
                }}
                onClick={() => selectTrack(i)}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: i === currentIdx ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)' }}
                >
                  {i === currentIdx && playing
                    ? <Pause size={12} style={{ color: '#818cf8' }} fill="#818cf8" />
                    : <Play  size={12} style={{ color: i === currentIdx ? '#818cf8' : 'rgba(255,255,255,0.4)' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] font-medium truncate"
                    style={{ color: i === currentIdx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)' }}
                  >
                    {item.name}
                  </p>
                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {(item.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  onClick={e => { e.stopPropagation(); removeFromPlaylist(i); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <Trash2 size={11} style={{ color: 'rgba(239,68,68,0.6)' }} />
                </motion.button>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerApp;
