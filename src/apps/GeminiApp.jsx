/**
 * GeminiApp.jsx
 * Google Gemini AI chat app for Virtual OS.
 *
 * Features:
 *  - API key input — stored in Supabase (gemini_api_keys table) and reloaded on login
 *  - Multiple chat sessions — each has a session_id UUID
 *  - Full chat history persisted to Supabase (chat_messages table)
 *  - Continue past conversations — messages fed back as Gemini history[] for full context
 *  - Streaming-style UX with typing indicator
 *  - Markdown-like rendering (bold, code blocks, bullet lists)
 *  - Model selector: gemini-2.0-flash (default), gemini-1.5-pro
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Plus, Trash2, Key, Eye, EyeOff,
  Loader2, AlertCircle, MessageSquare, ChevronLeft,
  Check, Settings2, Bot, User as UserIcon, RefreshCw,
} from 'lucide-react';
import supabase from '../lib/supabaseClient';

// ── Gemini API call ───────────────────────────────────────────────────────────
async function callGemini(apiKey, model, history, userMessage) {
  // Build Gemini contents array from history + new message
  const contents = [
    ...history.map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(No response)';
}

// ── Simple markdown renderer ──────────────────────────────────────────────────
const renderMarkdown = (text) => {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="rounded-xl overflow-x-auto my-2 p-3 text-xs font-mono"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#a5b4fc' }}>
          {codeLines.join('\n')}
        </pre>
      );
    }
    // Heading
    else if (line.startsWith('### ')) {
      elements.push(<p key={i} className="font-bold text-sm mt-3 mb-1" style={{ color: '#c4b5fd' }}>{line.slice(4)}</p>);
    }
    else if (line.startsWith('## ')) {
      elements.push(<p key={i} className="font-bold text-base mt-3 mb-1" style={{ color: '#a5b4fc' }}>{line.slice(3)}</p>);
    }
    // Bullet
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span style={{ color: '#818cf8', flexShrink: 0 }}>•</span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const [num, ...rest] = line.split('. ');
      elements.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span style={{ color: '#818cf8', flexShrink: 0, minWidth: 16 }}>{num}.</span>
          <span>{inlineFormat(rest.join('. '))}</span>
        </div>
      );
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    }
    // Normal paragraph
    else {
      elements.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>);
    }
    i++;
  }
  return elements;
};

// Inline bold/italic/code formatting
const inlineFormat = (text) => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} style={{ color: 'rgba(255,255,255,0.95)' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded text-xs font-mono"
          style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

// ── Chat message bubble ───────────────────────────────────────────────────────
const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: isUser
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
        }}
      >
        {isUser ? <UserIcon size={13} className="text-white" /> : <Bot size={13} className="text-white" />}
      </div>

      {/* Bubble */}
      <div
        className="max-w-[80%] px-4 py-3 rounded-2xl"
        style={{
          background: isUser
            ? 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.18))'
            : 'rgba(255,255,255,0.05)',
          border: isUser
            ? '1px solid rgba(99,102,241,0.3)'
            : '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.88)',
          borderTopRightRadius: isUser ? 4 : 16,
          borderTopLeftRadius:  isUser ? 16 : 4,
        }}
      >
        {isUser
          ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          : renderMarkdown(msg.content)
        }
        <p className="text-[9px] mt-1.5 text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </p>
      </div>
    </motion.div>
  );
};

// ── Typing indicator ──────────────────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex gap-3 flex-row">
    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)' }}>
      <Bot size={13} className="text-white" />
    </div>
    <div className="px-4 py-3 rounded-2xl" style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderTopLeftRadius: 4,
    }}>
      <div className="flex gap-1 items-center h-4">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#0ea5e9' }}
            animate={{ y: [-2, 2, -2] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
    </div>
  </div>
);

// ── API Key Setup screen ──────────────────────────────────────────────────────
const ApiKeySetup = ({ onSave, saving, error, initialKey = '', initialModel = 'gemini-3.5-flash' }) => {
  const [key, setKey]       = useState(initialKey);
  const [model, setModel]   = useState(initialModel);
  const [show, setShow]     = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-6 max-w-md mx-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)', boxShadow: '0 0 40px rgba(14,165,233,0.3)' }}
      >
        <Sparkles size={28} className="text-white" />
      </motion.div>

      <div className="text-center">
        <h2 className="text-lg font-bold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
          Connect Gemini AI
        </h2>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Your API key is stored securely in Supabase and reused on every login.
          Get a free key at{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
            className="text-sky-400 underline">aistudio.google.com</a>
        </p>
      </div>

      {/* Model selector */}
      <div className="w-full">
        <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Model</p>
        <div className="flex gap-2">
          {['gemini-3.5-flash', 'gemini-3.1-flash-lite'].map(m => (
            <button key={m} onClick={() => setModel(m)}
              className="flex-1 py-2 px-2 rounded-xl text-[11px] font-medium transition-all"
              style={{
                background: model === m ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.04)',
                border: model === m ? '1px solid rgba(14,165,233,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: model === m ? '#38bdf8' : 'rgba(255,255,255,0.4)',
              }}>
              {m.replace('gemini-', '').replace('-lite', ' Lite').replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* API Key input */}
      <div className="w-full">
        <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Gemini API Key</p>
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Key size={14} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <input
            type={show ? 'text' : 'password'}
            placeholder="AIza..."
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && key.trim() && onSave(key.trim(), model)}
            className="flex-1 bg-transparent text-sm outline-none font-mono"
            style={{ color: 'rgba(255,255,255,0.85)' }}
            autoFocus
          />
          <button onClick={() => setShow(v => !v)} className="opacity-50 hover:opacity-100">
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertCircle size={12} style={{ flexShrink: 0 }} />{error}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
        onClick={() => key.trim() && onSave(key.trim(), model)}
        disabled={!key.trim() || saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
        style={{
          background: key.trim() ? 'linear-gradient(135deg, #0ea5e9, #06b6d4)' : 'rgba(255,255,255,0.06)',
          color: key.trim() ? 'white' : 'rgba(255,255,255,0.25)',
          boxShadow: key.trim() ? '0 4px 20px rgba(14,165,233,0.35)' : 'none',
        }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {saving ? 'Saving…' : 'Save & Start Chatting'}
      </motion.button>
    </div>
  );
};

// ── Sessions sidebar ──────────────────────────────────────────────────────────
const SessionsSidebar = ({ sessions, currentSessionId, onSelect, onNew, onDelete }) => (
  <div className="flex flex-col h-full" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
    <div className="px-4 py-4 flex-shrink-0 flex items-center justify-between"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Chats
      </p>
      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onNew}
        className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}
        title="New chat">
        <Plus size={13} />
      </motion.button>
    </div>
    <div className="flex-1 overflow-y-auto py-2">
      {sessions.length === 0 ? (
        <p className="text-[11px] px-4 py-3" style={{ color: 'rgba(255,255,255,0.2)' }}>No chats yet</p>
      ) : (
        sessions.map(s => (
          <motion.div key={s.session_id} whileHover={{ x: 2 }}
            className="flex items-center gap-2 px-3 py-2.5 group cursor-pointer"
            onClick={() => onSelect(s.session_id)}
            style={{
              background: s.session_id === currentSessionId ? 'rgba(14,165,233,0.1)' : 'transparent',
              borderLeft: s.session_id === currentSessionId ? '2px solid #0ea5e9' : '2px solid transparent',
            }}>
            <MessageSquare size={12} style={{ color: s.session_id === currentSessionId ? '#38bdf8' : 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate"
                style={{ color: s.session_id === currentSessionId ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>
                {s.first_message || 'New chat'}
              </p>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {new Date(s.created_at).toLocaleDateString()}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.15 }}
              onClick={e => { e.stopPropagation(); onDelete(s.session_id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Trash2 size={10} style={{ color: 'rgba(239,68,68,0.6)' }} />
            </motion.button>
          </motion.div>
        ))
      )}
    </div>
  </div>
);

// ── Main GeminiApp ────────────────────────────────────────────────────────────
const GeminiApp = () => {
  const [apiKey,       setApiKey]       = useState(null);   // null = not loaded yet
  const [model,        setModel]        = useState('gemini-3.5-flash');
  const [keyLoading,   setKeyLoading]   = useState(true);
  const [keySaving,    setKeySaving]    = useState(false);
  const [keyError,     setKeyError]     = useState(null);

  const [sessions,     setSessions]     = useState([]);
  const [sessionId,    setSessionId]    = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [msgLoading,   setMsgLoading]   = useState(false);

  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [userId,       setUserId]       = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  // ── Load API key + sessions on mount ─────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!supabase) { setKeyLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      setUserId(uid);
      if (!uid) { setKeyLoading(false); return; }

      // Load API key
      const { data: keyRow } = await supabase
        .from('gemini_api_keys')
        .select('api_key, model')
        .eq('user_id', uid)
        .maybeSingle();

      if (keyRow) {
        setApiKey(keyRow.api_key);
        setModel(keyRow.model ?? 'gemini-3.5-flash');
      }
      setKeyLoading(false);

      // Load session list (first message of each session)
      await loadSessions(uid);
    };
    init();
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // ── Load sessions list ────────────────────────────────────────────────────
  const loadSessions = async (uid) => {
    if (!supabase || !uid) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('session_id, content, created_at')
      .eq('user_id', uid)
      .eq('role', 'user')
      .order('created_at', { ascending: true });

    if (!data) return;

    // Dedupe: keep first message per session
    const seen = new Map();
    for (const row of data) {
      if (!seen.has(row.session_id)) {
        seen.set(row.session_id, {
          session_id:    row.session_id,
          first_message: row.content.slice(0, 48) + (row.content.length > 48 ? '…' : ''),
          created_at:    row.created_at,
        });
      }
    }
    setSessions([...seen.values()].reverse());
  };

  // ── Load messages for a session ───────────────────────────────────────────
  const loadSession = async (sid) => {
    setSessionId(sid);
    setMessages([]);
    setSendError(null);
    if (!supabase || !userId) return;
    setMsgLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sid)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
    setMsgLoading(false);
  };

  // ── Start new chat ────────────────────────────────────────────────────────
  const newChat = () => {
    const sid = crypto.randomUUID();
    setSessionId(sid);
    setMessages([]);
    setSendError(null);
    setInput('');
  };

  // ── Delete session ────────────────────────────────────────────────────────
  const deleteSession = async (sid) => {
    setSessions(prev => prev.filter(s => s.session_id !== sid));
    if (sessionId === sid) newChat();
    if (!supabase || !userId) return;
    await supabase.from('chat_messages').delete()
      .match({ user_id: userId, session_id: sid });
  };

  // ── Save API key ──────────────────────────────────────────────────────────
  const saveApiKey = async (key, mdl) => {
    setKeySaving(true);
    setKeyError(null);
    // Test the key with a quick ping
    try {
      await callGemini(key, mdl, [], 'Say hello in one word.');
    } catch (err) {
      setKeyError(`Key test failed: ${err.message}`);
      setKeySaving(false);
      return;
    }

    setApiKey(key);
    setModel(mdl);
    setShowSettings(false);

    if (supabase && userId) {
      await supabase.from('gemini_api_keys').upsert(
        { user_id: userId, api_key: key, model: mdl },
        { onConflict: 'user_id' }
      );
    }
    setKeySaving(false);
    if (!sessionId) newChat();
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !apiKey || sending) return;

    const sid = sessionId ?? crypto.randomUUID();
    if (!sessionId) setSessionId(sid);

    const userMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      session_id: sid,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setSendError(null);

    try {
      // Call Gemini with full history for context
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const reply = await callGemini(apiKey, model, history, text);

      const modelMsg = {
        id: `temp-model-${Date.now()}`,
        role: 'model',
        content: reply,
        session_id: sid,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, modelMsg]);

      // Persist both messages to Supabase
      if (supabase && userId) {
        const { data } = await supabase.from('chat_messages').insert([
          { user_id: userId, session_id: sid, role: 'user',  content: text  },
          { user_id: userId, session_id: sid, role: 'model', content: reply },
        ]).select();

        // Replace temp IDs with real UUIDs
        if (data) {
          setMessages(prev => {
            const stored = [...prev];
            data.forEach(row => {
              const idx = stored.findIndex(m => m.role === row.role && m.content === row.content && m.id.startsWith('temp-'));
              if (idx !== -1) stored[idx] = row;
            });
            return stored;
          });
        }

        // Refresh sessions list if this is the first message
        if (messages.length === 0) await loadSessions(userId);
      }
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }, [input, apiKey, model, sending, sessionId, messages, userId]);

  // ── Keyboard shortcut ──────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (keyLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <Loader2 size={20} className="animate-spin" style={{ color: '#0ea5e9' }} />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  // ── No API key or settings open ───────────────────────────────────────────
  if (!apiKey || showSettings) {
    return <ApiKeySetup onSave={saveApiKey} saving={keySaving} error={keyError} initialKey={apiKey || ''} initialModel={model} />;
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ color: 'rgba(255,255,255,0.88)' }}>

      {/* ── Sessions sidebar ── */}
      <div className="flex-shrink-0 w-48 overflow-hidden">
        <SessionsSidebar
          sessions={sessions}
          currentSessionId={sessionId}
          onSelect={loadSession}
          onNew={newChat}
          onDelete={deleteSession}
        />
      </div>

      {/* ── Chat panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)' }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>Gemini AI</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={newChat}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
              style={{ background: 'rgba(255,255,255,0.06)' }} title="New chat">
              <Plus size={14} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
              style={{ background: 'rgba(255,255,255,0.06)' }} title="API settings">
              <Settings2 size={14} />
            </motion.button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {msgLoading ? (
            <div className="flex items-center justify-center h-32 gap-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading chat…</span>
            </div>
          ) : messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full gap-4 text-center"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(6,182,212,0.15))', border: '1px solid rgba(14,165,233,0.25)' }}>
                <Sparkles size={28} style={{ color: '#0ea5e9' }} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Start a conversation</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Ask anything — history is saved and you can continue later
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {[
                  'Explain quantum computing simply',
                  'Write a Python function',
                  'Help me debug my code',
                  'Summarise a topic',
                ].map(hint => (
                  <motion.button key={hint} whileHover={{ scale: 1.03 }}
                    onClick={() => { setInput(hint); textareaRef.current?.focus(); }}
                    className="p-2.5 rounded-xl text-left text-[11px]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                    {hint}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
              {sending && <TypingIndicator />}
            </>
          )}
          {sendError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <AlertCircle size={12} style={{ flexShrink: 0 }} />{sendError}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2">
          <div className="flex items-end gap-2 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Gemini… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="flex-1 bg-transparent text-sm outline-none resize-none placeholder:text-white/20"
              style={{
                color: 'rgba(255,255,255,0.88)',
                maxHeight: 120,
                lineHeight: '1.5',
                colorScheme: 'dark',
              }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <motion.button
              whileHover={input.trim() ? { scale: 1.08 } : {}}
              whileTap={input.trim() ? { scale: 0.93 } : {}}
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: input.trim() ? 'linear-gradient(135deg, #0ea5e9, #06b6d4)' : 'rgba(255,255,255,0.08)',
                boxShadow: input.trim() ? '0 2px 12px rgba(14,165,233,0.35)' : 'none',
              }}
            >
              {sending
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <Send size={14} className={input.trim() ? 'text-white' : 'text-white/25'} />
              }
            </motion.button>
          </div>
          <p className="text-[10px] text-center mt-1.5" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Gemini may make mistakes. All chats saved to Supabase.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeminiApp;
