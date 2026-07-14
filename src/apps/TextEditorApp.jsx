/**
 * TextEditorApp.jsx
 * Distraction-free text editor with Google Drive cloud save.
 * Features: file name input, rich textarea, word/char count, Save to Cloud button.
 * Drive sync state is broadcast through useDriveStore so the Taskbar tray can
 * reflect the upload status in real time.
 */
import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Cloud, CloudOff, Check, AlertTriangle,
  Loader2, RotateCcw, Clock, Info,
} from 'lucide-react';
import { saveFileToDrive } from '../lib/driveService';
import useDriveStore from '../store/driveStore';
import supabase from '../lib/supabaseClient';

// ── Word / character counter ─────────────────────────────────────────────────
const useTextStats = (text) => {
  const chars  = text.length;
  const words  = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const lines  = text.split('\n').length;
  return { chars, words, lines };
};

// ── Save status badge shown inside the editor header ─────────────────────────
const StatusBadge = ({ status, fileName }) => {
  const configs = {
    idle:    { icon: null,          label: '',                            color: 'transparent' },
    syncing: { icon: Loader2,       label: 'Saving to Drive…',            color: '#6366f1', spin: true },
    success: { icon: Check,         label: `Saved as ${fileName}`,        color: '#22c55e' },
    error:   { icon: AlertTriangle, label: 'Save failed — see tray',      color: '#f59e0b' },
  };
  const cfg = configs[status];
  if (status === 'idle') return null;
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{
          background: `${cfg.color}18`,
          border: `1px solid ${cfg.color}40`,
          color: cfg.color,
        }}
      >
        <Icon size={12} className={cfg.spin ? 'animate-spin' : ''} />
        <span>{cfg.label}</span>
      </motion.div>
    </AnimatePresence>
  );
};

// ── Main TextEditorApp ────────────────────────────────────────────────────────
const TextEditorApp = () => {
  const [fileName, setFileName] = useState('');
  const [content,  setContent]  = useState('');
  const [localErr, setLocalErr] = useState('');

  const { syncStatus, lastSynced, lastFileName, setSyncing, setSuccess, setError, resetStatus } = useDriveStore();
  const { chars, words, lines } = useTextStats(content);

  // Auto-reset success indicator after 4 s
  const successTimer = useRef(null);

  const handleSave = useCallback(async () => {
    setLocalErr('');

    // ── Offline mock mode ──
    if (!supabase) {
      setSyncing();
      await new Promise(r => setTimeout(r, 1200)); // simulate latency
      const name = (fileName.trim() || 'Untitled') + '.txt';
      setSuccess(name);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(resetStatus, 4000);
      return;
    }

    // ── Live Drive upload ──
    if (!fileName.trim() && !content.trim()) {
      setLocalErr('Please enter a file name and some content before saving.');
      return;
    }

    setSyncing();
    try {
      const result = await saveFileToDrive(fileName || 'Untitled', content);
      setSuccess(result.name);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(resetStatus, 4000);
    } catch (err) {
      console.error('[TextEditor] Save error:', err);
      setError(err.message);
    }
  }, [fileName, content, setSyncing, setSuccess, setError, resetStatus]);

  const isSyncing = syncStatus === 'syncing';

  return (
    <div
      className="flex flex-col h-full p-6 space-y-6 overflow-hidden"
      style={{ color: 'rgba(255,255,255,0.88)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #06b6d4, #6366f1)' }}
        >
          <FileText size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold leading-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
            Text Editor
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Cloud-synced via Google Drive · WebOS_Data/
          </p>
        </div>

        {/* Status badge */}
        <StatusBadge status={syncStatus} fileName={lastFileName} />
      </div>

      {/* ── File name input ── */}
      <div className="space-y-2">
        <label
          htmlFor="editor-filename"
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          File Name
        </label>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <FileText size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <input
            id="editor-filename"
            type="text"
            placeholder="my-document"
            value={fileName}
            onChange={e => { setFileName(e.target.value); setLocalErr(''); }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/20"
            style={{ color: 'rgba(255,255,255,0.88)' }}
          />
          <span
            className="text-xs flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            .txt
          </span>
        </div>
      </div>

      {/* ── Textarea ── */}
      <div className="flex-1 flex flex-col space-y-2 min-h-0">
        <label
          htmlFor="editor-content"
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Content
        </label>
        <div
          className="flex-1 min-h-0 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <textarea
            id="editor-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Start typing your document…"
            className="w-full h-full resize-none bg-transparent text-sm outline-none p-4 leading-relaxed"
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontFamily: "'Inter', 'Consolas', monospace",
              minHeight: 0,
            }}
            spellCheck
          />
        </div>
      </div>

      {/* ── Footer bar ── */}
      <div className="flex items-center gap-4">
        {/* Text stats */}
        <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span>{words} word{words !== 1 ? 's' : ''}</span>
          <span>{chars} char{chars !== 1 ? 's' : ''}</span>
          <span>{lines} line{lines !== 1 ? 's' : ''}</span>
        </div>

        {/* Last saved */}
        {lastSynced && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <Clock size={11} />
            <span>
              Last saved {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Validation error */}
        {localErr && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs flex items-center gap-1"
            style={{ color: '#f87171' }}
          >
            <Info size={11} />
            {localErr}
          </motion.span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Save button */}
        <motion.button
          whileHover={isSyncing ? {} : { scale: 1.03, y: -1 }}
          whileTap={isSyncing   ? {} : { scale: 0.97 }}
          onClick={handleSave}
          disabled={isSyncing}
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: isSyncing
              ? 'rgba(99,102,241,0.3)'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            boxShadow: isSyncing ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
            cursor: isSyncing ? 'wait' : 'pointer',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: 148,
          }}
        >
          {isSyncing ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Saving…</span>
            </>
          ) : syncStatus === 'success' ? (
            <>
              <Check size={15} />
              <span>Saved!</span>
            </>
          ) : syncStatus === 'error' ? (
            <>
              <RotateCcw size={15} />
              <span>Retry Save</span>
            </>
          ) : (
            <>
              <Cloud size={15} />
              <span>Save to Cloud</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default TextEditorApp;
