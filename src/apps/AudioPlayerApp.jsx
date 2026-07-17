/**
 * AudioPlayerApp.jsx
 * Audio player with two source modes:
 *
 * 1. DRIVE mode — Lists files from WebOS_Data/audio/ in Google Drive.
 *    Uses getDriveFileBlob() to fetch the file with Bearer token and create
 *    a Blob object URL. This is the ONLY correct way to play private Drive
 *    audio in an HTML element (webContentLink is a public-share URL that
 *    doesn't work for private files).
 *
 * 2. LOCAL mode — User picks files from their local system.
 *    Uses createObjectURL() for instant, lag-free playback.
 *
 * Supported audio formats (HTML5 native):
 *   ✅ MP3  (.mp3)  — Universal support
 *   ✅ WAV  (.wav)  — Universal support
 *   ✅ OGG  (.ogg)  — Chrome, Firefox
 *   ✅ AAC  (.aac)  — Chrome, Safari, Edge
 *   ✅ FLAC (.flac) — Chrome, Firefox, Safari
 *   ✅ M4A  (.m4a)  — Chrome, Safari, Edge
 *   ✅ WebM (.webm) — Chrome, Firefox
 *   ✅ OPUS (.opus) — Chrome, Firefox
 *
 * Features: play/pause, prev/next, seek bar, volume (from global mediaStore),
 * shuffle, repeat (none/all/one), like/heart, animated visualizer,
 * per-track loading indicator (Drive fetch progress).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Shuffle, Repeat, Repeat1,
  Music, Loader2, AlertCircle, ListMusic, Heart,
  FolderOpen, Cloud, HardDrive, Plus, Trash2,
} from 'lucide-react';
import { listDriveFolder, getDriveFileBlob } from '../lib/driveService';
import useMediaStore from '../store/mediaStore';
import supabase from '../lib/supabaseClient';

// ── Time formatter ────────────────────────────────────────────────────────────
const fmtTime = (secs) => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ── Format size ───────────────────────────────────────────────────────────────
const fmtSize = (bytes) => {
  if (!bytes) return '';
  const b = parseInt(bytes);
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

// ── Animated visualizer bars ──────────────────────────────────────────────────
const Visualizer = ({ playing, color = '#ec4899' }) => {
  const bars = 26;
  return (
    <div className="flex items-end gap-0.5 h-10 px-1">
      {Array.from({ length: bars }).map((_, i) => {
        const base = 6 + Math.sin(i * 0.7) * 8;
        return (
          <motion.div
            key={i}
            className="rounded-full flex-1"
            style={{ background: `${color}bb`, minHeight: 3 }}
            animate={playing ? {
              height: [base, base + 18 + i % 4 * 5, base + 5, base + 28, base],
            } : { height: base }}
            transition={{
              duration: playing ? 0.6 + (i % 5) * 0.1 : 0.3,
              repeat: playing ? Infinity : 0,
              repeatType: 'mirror',
              delay: i * 0.025,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </div>
  );
};

// ── Track entry type (Drive or Local) ─────────────────────────────────────────
// drive: { id, name, mimeType, size, source: 'drive', blobUrl?: string }
// local: { id, name, size, source: 'local', blobUrl: string }

// ── Liked hook ────────────────────────────────────────────────────────────────
const useLiked = () => {
  const [liked, setLiked] = useState(new Set());
  const toggle = (id) => setLiked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return { liked, toggle };
};

// ── Source mode selector ──────────────────────────────────────────────────────
const SourceToggle = ({ mode, onChange }) => (
  <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
    {[
      { id: 'drive', label: 'Drive', Icon: Cloud },
      { id: 'local', label: 'Local', Icon: HardDrive },
    ].map(({ id, label, Icon }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
        style={{
          background: mode === id ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.04)',
          color: mode === id ? '#f472b6' : 'rgba(255,255,255,0.4)',
          borderRight: id === 'drive' ? '1px solid rgba(255,255,255,0.1)' : 'none',
        }}
      >
        <Icon size={11} />
        {label}
      </button>
    ))}
  </div>
);

// ── Main AudioPlayerApp ───────────────────────────────────────────────────────
const AudioPlayerApp = () => {
  const [sourceMode,   setSourceMode]   = useState('drive'); // 'drive' | 'local'
  const [tracks,       setTracks]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [driveError,   setDriveError]   = useState(null);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [shuffle,      setShuffle]      = useState(false);
  const [repeat,       setRepeat]       = useState('none');   // 'none'|'all'|'one'
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [loadingTrack, setLoadingTrack] = useState(null);    // id of track being fetched from Drive

  const { volume, muted, setVolume, toggleMute, effectiveVolume } = useMediaStore();
  const { liked, toggle: toggleLike } = useLiked();

  const audioRef    = useRef(null);
  const fileInputRef= useRef(null);
  const blobCache   = useRef({});   // fileId → objectURL

  // ── Load Drive audio files ────────────────────────────────────────────────
  const loadDriveFiles = useCallback(async () => {
    if (!supabase) {
      setDriveError('Sign in with Google to access Drive audio files.');
      return;
    }
    setLoading(true);
    setDriveError(null);
    try {
      const files = await listDriveFolder('audio');
      const audioFiles = files.filter(f =>
        f.mimeType?.startsWith('audio/') ||
        /\.(mp3|wav|ogg|flac|aac|m4a|opus|webm)$/i.test(f.name)
      );
      setTracks(audioFiles.map(f => ({ ...f, source: 'drive', blobUrl: null })));
    } catch (err) {
      setDriveError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sourceMode === 'drive') {
      loadDriveFiles();
    }
  }, [sourceMode, loadDriveFiles]);

  // ── Cleanup blob URLs on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(blobCache.current).forEach(url => URL.revokeObjectURL(url));
      tracks.filter(t => t.source === 'local').forEach(t => URL.revokeObjectURL(t.blobUrl));
    };
  }, []); // eslint-disable-line

  // ── Sync global volume to audio element ───────────────────────────────────
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = effectiveVolume();
    }
  }, [volume, muted, effectiveVolume]);

  // ── Get/resolve playback URL for current track ────────────────────────────
  const getTrackUrl = useCallback(async (track) => {
    if (!track) return null;
    if (track.source === 'local') return track.blobUrl;

    // Drive track — use cached blob URL or fetch a new one
    if (blobCache.current[track.id]) return blobCache.current[track.id];

    setLoadingTrack(track.id);
    try {
      const url = await getDriveFileBlob(track.id);
      blobCache.current[track.id] = url;
      // Update track with resolved URL
      setTracks(prev => prev.map(t => t.id === track.id ? { ...t, blobUrl: url } : t));
      return url;
    } catch (err) {
      console.error('[AudioPlayer] Failed to load track:', err);
      setDriveError(`Cannot load "${track.name}": ${err.message}`);
      return null;
    } finally {
      setLoadingTrack(null);
    }
  }, []);

  // ── Play a track by resolving its URL ─────────────────────────────────────
  const playTrack = useCallback(async (idx, autoplay = true) => {
    const track = tracks[idx];
    if (!track) return;

    const url = await getTrackUrl(track);
    if (!url) return;

    const a = audioRef.current;
    if (!a) return;

    a.src = url;
    a.volume = effectiveVolume();
    if (autoplay) {
      try { await a.play(); } catch { /* user gesture required on some browsers */ }
    }
    setCurrentIdx(idx);
    setCurrentTime(0);
  }, [tracks, getTrackUrl, effectiveVolume]);

  const current = tracks[currentIdx];

  // ── Audio events ──────────────────────────────────────────────────────────
  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };
  const handlePlay     = () => setPlaying(true);
  const handlePause    = () => setPlaying(false);
  const handleLoaded   = () => setDuration(audioRef.current?.duration ?? 0);

  const getNextIdx = useCallback(() => {
    if (shuffle) {
      let n = currentIdx;
      while (n === currentIdx && tracks.length > 1) n = Math.floor(Math.random() * tracks.length);
      return n;
    }
    return currentIdx < tracks.length - 1 ? currentIdx + 1 : 0;
  }, [shuffle, currentIdx, tracks.length]);

  const handleEnded = useCallback(() => {
    if (repeat === 'one') {
      const a = audioRef.current;
      if (a) { a.currentTime = 0; a.play(); }
    } else if (repeat === 'all' || currentIdx < tracks.length - 1) {
      playTrack(getNextIdx(), true);
    } else {
      setPlaying(false);
    }
  }, [repeat, currentIdx, tracks.length, getNextIdx, playTrack]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !tracks.length) return;
    if (a.src) {
      if (playing) a.pause(); else a.play();
    } else {
      playTrack(currentIdx, true);
    }
  };

  const seek = (val) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = parseFloat(val);
    setCurrentTime(a.currentTime);
  };

  const playNext = () => playTrack(getNextIdx(), true);
  const playPrev = () => {
    if (currentTime > 3) { seek(0); return; }
    playTrack(Math.max(0, currentIdx - 1), true);
  };

  const cycleRepeat = () => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none');

  // ── Local file picker ─────────────────────────────────────────────────────
  const handleLocalFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newTracks = files.map(f => ({
      id: `local-${f.name}-${f.size}`,
      name: f.name,
      size: f.size,
      mimeType: f.type,
      source: 'local',
      blobUrl: URL.createObjectURL(f),
    }));
    setTracks(prev => [...prev, ...newTracks]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeTrack = (idx) => {
    const t = tracks[idx];
    if (t.source === 'local') URL.revokeObjectURL(t.blobUrl);
    if (t.source === 'drive' && blobCache.current[t.id]) {
      URL.revokeObjectURL(blobCache.current[t.id]);
      delete blobCache.current[t.id];
    }
    setTracks(prev => prev.filter((_, i) => i !== idx));
    if (currentIdx >= idx && currentIdx > 0) setCurrentIdx(i => i - 1);
  };

  // ── Switch source mode ────────────────────────────────────────────────────
  const handleSourceChange = (mode) => {
    if (mode === sourceMode) return;
    setSourceMode(mode);
    if (mode === 'local') {
      setTracks([]);
      setDriveError(null);
    }
    setPlaying(false);
    setCurrentIdx(0);
    setCurrentTime(0);
    setDuration(0);
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ── Loading / Error states ────────────────────────────────────────────────
  const renderPanel = () => {
    if (sourceMode === 'drive' && loading) {
      return (
        <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <Loader2 size={24} className="animate-spin" style={{ color: '#ec4899' }} />
          <p className="text-xs">Loading from Drive…</p>
        </div>
      );
    }
    if (sourceMode === 'drive' && driveError) {
      return (
        <div className="flex flex-col items-center justify-center h-40 gap-2 p-4 text-center">
          <AlertCircle size={20} style={{ color: '#f87171' }} />
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{driveError}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ color: 'rgba(255,255,255,0.88)' }}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoaded}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/aac,audio/m4a,audio/webm,audio/opus,.mp3,.wav,.ogg,.flac,.aac,.m4a,.opus,.webm"
        multiple
        className="hidden"
        onChange={handleLocalFiles}
      />

      {/* ── Player panel ── */}
      <div
        className="flex-shrink-0 flex flex-col overflow-hidden"
        style={{
          width: showPlaylist ? 268 : '100%',
          borderRight: showPlaylist ? '1px solid rgba(255,255,255,0.07)' : 'none',
        }}
      >
        {/* Artwork + source selector area */}
        <div
          className="relative flex-shrink-0 flex flex-col items-center gap-4 px-6 pt-5 pb-4"
          style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(99,102,241,0.12))' }}
        >
          {/* Source mode toggle */}
          <div className="w-full flex items-center justify-between">
            <SourceToggle mode={sourceMode} onChange={handleSourceChange} />
            {sourceMode === 'local' && (
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.3)' }}
              >
                <Plus size={11} />Add Files
              </motion.button>
            )}
            {sourceMode === 'drive' && (
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={loadDriveFiles}
                className="text-[10px] px-2 py-1 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
              >
                Refresh
              </motion.button>
            )}
          </div>

          {/* Vinyl disc */}
          <motion.div
            animate={playing ? { rotate: 360 } : {}}
            transition={playing ? { repeat: Infinity, duration: 7, ease: 'linear' } : {}}
            className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #ec4899, #6366f1)',
              boxShadow: playing
                ? '0 0 40px rgba(236,72,153,0.5), 0 0 80px rgba(99,102,241,0.25)'
                : '0 8px 32px rgba(0,0,0,0.5)',
              border: '3px solid rgba(255,255,255,0.12)',
            }}
          >
            {loadingTrack === current?.id
              ? <Loader2 size={32} className="text-white animate-spin" />
              : <Music size={36} className="text-white" strokeWidth={1.5} />
            }
          </motion.div>

          {/* Track info */}
          <div className="text-center w-full">
            <p className="text-sm font-bold truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {current?.name?.replace(/\.[^.]+$/, '') ?? 'No track selected'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {current ? (current.source === 'drive' ? 'Drive · audio/' : 'Local file') : 'Select a track to play'}
            </p>
          </div>

          {/* Heart */}
          {current && (
            <motion.button
              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
              onClick={() => toggleLike(current.id)}
              className="absolute right-5 top-16"
            >
              <Heart
                size={18}
                fill={liked.has(current.id) ? '#f43f5e' : 'transparent'}
                style={{ color: liked.has(current.id) ? '#f43f5e' : 'rgba(255,255,255,0.3)' }}
              />
            </motion.button>
          )}
        </div>

        {/* Visualizer */}
        <div style={{ background: 'rgba(0,0,0,0.18)' }}>
          <Visualizer playing={playing} color="#ec4899" />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 space-y-4">
          {/* Seek bar */}
          <div>
            <div
              className="relative w-full h-1.5 rounded-full cursor-pointer group"
              style={{ background: 'rgba(255,255,255,0.12)' }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - rect.left) / rect.width) * duration);
              }}
            >
              <div
                className="absolute top-0 left-0 h-full rounded-full"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ec4899, #6366f1)' }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 shadow-lg transition-opacity"
                style={{ left: `calc(${pct}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span>{fmtTime(currentTime)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>

          {/* Playback buttons */}
          <div className="flex items-center justify-between">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setShuffle(s => !s)}>
              <Shuffle size={15} style={{ color: shuffle ? '#f472b6' : 'rgba(255,255,255,0.35)' }} />
            </motion.button>

            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={playPrev}>
              <SkipBack size={21} style={{ color: 'rgba(255,255,255,0.8)' }} fill="rgba(255,255,255,0.8)" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={togglePlay}
              disabled={!tracks.length}
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: tracks.length
                  ? 'linear-gradient(135deg, #ec4899, #6366f1)'
                  : 'rgba(255,255,255,0.1)',
                boxShadow: tracks.length ? '0 4px 20px rgba(236,72,153,0.4)' : 'none',
              }}
            >
              {loadingTrack
                ? <Loader2 size={20} className="text-white animate-spin" />
                : playing
                  ? <Pause size={20} className="text-white" />
                  : <Play  size={20} className="text-white ml-0.5" />
              }
            </motion.button>

            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={playNext}>
              <SkipForward size={21} style={{ color: 'rgba(255,255,255,0.8)' }} fill="rgba(255,255,255,0.8)" />
            </motion.button>

            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={cycleRepeat}>
              {repeat === 'one'
                ? <Repeat1 size={15} style={{ color: '#f472b6' }} />
                : <Repeat  size={15} style={{ color: repeat === 'all' ? '#f472b6' : 'rgba(255,255,255,0.35)' }} />
              }
            </motion.button>
          </div>

          {/* Volume + playlist toggle */}
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.1 }} onClick={toggleMute}>
              {muted || volume === 0
                ? <VolumeX size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
                : <Volume2 size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
              }
            </motion.button>
            <input
              type="range" min="0" max="1" step="0.01"
              value={muted ? 0 : volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="flex-1 accent-pink-400"
              style={{ cursor: 'pointer' }}
            />
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowPlaylist(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
              style={{
                background: showPlaylist ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.06)',
                color: showPlaylist ? '#f472b6' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${showPlaylist ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <ListMusic size={12} />
            </motion.button>
          </div>

          {/* Drive error inline */}
          {driveError && sourceMode === 'drive' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-start gap-2 p-2 rounded-lg text-xs"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle size={12} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: '#f87171' }}>{driveError}</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Playlist panel ── */}
      <AnimatePresence>
        {showPlaylist && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div
              className="px-4 py-3 flex-shrink-0 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {sourceMode === 'drive' ? '📂 Drive' : '💻 Local'} · {tracks.length} track{tracks.length !== 1 ? 's' : ''}
              </p>
              {sourceMode === 'local' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                >
                  <Plus size={10} />Add
                </motion.button>
              )}
            </div>

            {/* Panel content */}
            {renderPanel() || (
              <div className="flex-1 overflow-y-auto py-1">
                {tracks.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    <Music size={32} strokeWidth={1.5} />
                    <p className="text-xs">
                      {sourceMode === 'drive'
                        ? 'No audio files in Drive WebOS_Data/audio/'
                        : 'Click "Add Files" to load local audio'
                      }
                    </p>
                    {sourceMode === 'local' && (
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
                        style={{ background: 'rgba(236,72,153,0.12)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.25)' }}
                      >
                        <FolderOpen size={13} />Browse Files
                      </motion.button>
                    )}
                  </div>
                ) : (
                  tracks.map((t, i) => {
                    const isLoading = loadingTrack === t.id;
                    return (
                      <motion.div
                        key={t.id}
                        whileHover={{ x: 2 }}
                        className="flex items-center gap-2.5 px-4 py-2.5 group cursor-pointer"
                        onClick={() => playTrack(i, true)}
                        style={{
                          background: i === currentIdx ? 'rgba(236,72,153,0.1)' : 'transparent',
                          borderLeft: i === currentIdx ? '2px solid #ec4899' : '2px solid transparent',
                        }}
                      >
                        {/* Track icon */}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: i === currentIdx ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.06)' }}
                        >
                          {isLoading ? (
                            <Loader2 size={12} className="animate-spin" style={{ color: '#f472b6' }} />
                          ) : i === currentIdx && playing ? (
                            <div className="flex items-end gap-0.5 h-4">
                              {[1, 2, 3].map(b => (
                                <motion.div
                                  key={b}
                                  className="w-0.5 rounded-sm"
                                  style={{ background: '#f472b6' }}
                                  animate={{ height: [3, 12, 4, 10, 3] }}
                                  transition={{ duration: 0.8, repeat: Infinity, delay: b * 0.12 }}
                                />
                              ))}
                            </div>
                          ) : (
                            <Music size={12} style={{ color: i === currentIdx ? '#f472b6' : 'rgba(255,255,255,0.35)' }} />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-medium truncate"
                            style={{ color: i === currentIdx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)' }}
                          >
                            {t.name.replace(/\.[^.]+$/, '')}
                          </p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            {fmtSize(t.size)}
                          </p>
                        </div>

                        {/* Like + remove */}
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <motion.button whileHover={{ scale: 1.2 }} onClick={e => { e.stopPropagation(); toggleLike(t.id); }}>
                            <Heart
                              size={11}
                              fill={liked.has(t.id) ? '#f43f5e' : 'transparent'}
                              style={{ color: liked.has(t.id) ? '#f43f5e' : 'rgba(255,255,255,0.25)' }}
                            />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            onClick={e => { e.stopPropagation(); removeTrack(i); }}
                          >
                            <Trash2 size={10} style={{ color: 'rgba(239,68,68,0.5)' }} />
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AudioPlayerApp;
