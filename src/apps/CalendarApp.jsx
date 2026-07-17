/**
 * CalendarApp.jsx
 * Full-featured calendar with month navigation, event creation/deletion, and day view.
 *
 * Persistence strategy:
 *  - Events are stored in Supabase public.calendar_events table (see calendar_sql.md)
 *  - RLS ensures each user only sees their own events (auth.uid() = user_id)
 *  - Offline/no-Supabase: falls back to in-memory state (events lost on refresh)
 *
 * Fields: title, date, time, end_time, color, description, user_id
 */
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar, Plus, X, Clock,
  Trash2, Tag, Check, Loader2, AlertCircle, AlignLeft,
} from 'lucide-react';
import supabase from '../lib/supabaseClient';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const EVENT_COLORS = [
  { label: 'Indigo',  bg: '#6366f1', light: '#818cf8' },
  { label: 'Rose',    bg: '#f43f5e', light: '#fb7185' },
  { label: 'Emerald', bg: '#10b981', light: '#34d399' },
  { label: 'Amber',   bg: '#f59e0b', light: '#fbbf24' },
  { label: 'Cyan',    bg: '#06b6d4', light: '#22d3ee' },
  { label: 'Violet',  bg: '#8b5cf6', light: '#a78bfa' },
];

// ISO date key: YYYY-MM-DD
const dateKey = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function getUserId() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function fetchEvents() {
  if (!supabase) return {};
  const userId = await getUserId();
  if (!userId) return {};

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) throw error;

  // Group by date key
  const grouped = {};
  for (const row of data) {
    const key = row.date; // already YYYY-MM-DD from Supabase
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      id:          row.id,
      title:       row.title,
      time:        row.time?.slice(0, 5) ?? '',      // "HH:MM"
      end_time:    row.end_time?.slice(0, 5) ?? '',
      description: row.description ?? '',
      color:       EVENT_COLORS.find(c => c.bg === row.color) ?? EVENT_COLORS[0],
    });
  }
  return grouped;
}

async function insertEvent(userId, key, event) {
  const { data, error } = await supabase.from('calendar_events').insert({
    user_id:     userId,
    title:       event.title,
    date:        key,
    time:        event.time   || null,
    end_time:    event.end_time || null,
    color:       event.color.bg,
    description: event.description || null,
  }).select().single();
  if (error) throw error;
  return data.id; // UUID from Supabase
}

async function deleteEvent(id) {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}

// ── Event Modal ───────────────────────────────────────────────────────────────
const EventModal = ({ date, year, month, events, userId, onClose, onAdd, onDelete, saving, deleting }) => {
  const [title,       setTitle]       = useState('');
  const [time,        setTime]        = useState('09:00');
  const [endTime,     setEndTime]     = useState('');
  const [description, setDescription] = useState('');
  const [colorIdx,    setColorIdx]    = useState(0);

  const key = dateKey(year, month, date);
  const dayEvents = events[key] || [];

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(key, {
      title:       title.trim(),
      time,
      end_time:    endTime,
      description,
      color:       EVENT_COLORS[colorIdx],
    });
    setTitle(''); setEndTime(''); setDescription('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl overflow-hidden w-full max-w-md"
        style={{
          background: 'rgba(14,14,32,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#818cf8' }}>
              {MONTHS[month]} {date}, {year}
            </p>
            <h3 className="text-base font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Events
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* Existing events */}
        <div className="overflow-y-auto px-6 py-4 space-y-2.5 flex-1">
          {dayEvents.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
              No events — add one below
            </p>
          ) : (
            dayEvents.map(ev => (
              <motion.div
                key={ev.id}
                layout
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 p-3 rounded-xl group"
                style={{
                  background: `${ev.color.bg}14`,
                  border: `1px solid ${ev.color.bg}30`,
                }}
              >
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: ev.color.bg }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{ev.title}</p>
                  {(ev.time || ev.end_time) && (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      <Clock size={10} />
                      {ev.time}{ev.end_time ? ` – ${ev.end_time}` : ''}
                    </p>
                  )}
                  {ev.description && (
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{ev.description}</p>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  onClick={() => onDelete(key, ev.id)}
                  disabled={deleting === ev.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  {deleting === ev.id
                    ? <Loader2 size={13} className="animate-spin" style={{ color: '#f87171' }} />
                    : <Trash2 size={13} style={{ color: 'rgba(239,68,68,0.6)' }} />
                  }
                </motion.button>
              </motion.div>
            ))
          )}
        </div>

        {/* Add new event form */}
        <div className="px-6 pb-6 pt-2 space-y-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mt-3"
            style={{ color: 'rgba(255,255,255,0.3)' }}>New Event</p>

          {/* Title */}
          <input
            type="text"
            placeholder="Event title (required)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="w-full px-4 py-2.5 rounded-xl bg-transparent text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.88)',
            }}
          />

          {/* Time row */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Clock size={12} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="bg-transparent text-xs outline-none flex-1"
                style={{ color: 'rgba(255,255,255,0.75)', colorScheme: 'dark' }} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Start</span>
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Clock size={12} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="bg-transparent text-xs outline-none flex-1"
                style={{ color: 'rgba(255,255,255,0.75)', colorScheme: 'dark' }} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>End</span>
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <AlignLeft size={12} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: 2 }} />
            <textarea
              placeholder="Notes (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="bg-transparent text-xs outline-none flex-1 resize-none"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            />
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-2">
            <Tag size={11} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <div className="flex gap-2">
              {EVENT_COLORS.map((c, i) => (
                <motion.button
                  key={c.label}
                  whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setColorIdx(i)}
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: c.bg,
                    border: colorIdx === i ? '2px solid white' : '2px solid transparent',
                    boxShadow: colorIdx === i ? `0 0 0 2px ${c.bg}` : 'none',
                  }}
                >
                  {colorIdx === i && <Check size={9} className="text-white" strokeWidth={3} />}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Add button */}
          <motion.button
            whileHover={title.trim() ? { scale: 1.02 } : {}}
            whileTap={title.trim() ? { scale: 0.98 } : {}}
            onClick={handleAdd}
            disabled={!title.trim() || saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: title.trim()
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'rgba(255,255,255,0.06)',
              color: title.trim() ? 'white' : 'rgba(255,255,255,0.25)',
              boxShadow: title.trim() ? '0 4px 16px rgba(99,102,241,0.35)' : 'none',
            }}
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" />Saving…</>
              : <><Plus size={15} />Add Event</>
            }
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main CalendarApp ──────────────────────────────────────────────────────────
const CalendarApp = () => {
  const today = new Date();
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [events,      setEvents]      = useState({});        // { 'YYYY-MM-DD': [event, …] }
  const [selected,    setSelected]    = useState(null);      // day number | null
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(null);      // event id being deleted
  const [userId,      setUserId]      = useState(null);

  // ── Load events from Supabase on mount ──────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const uid = await getUserId();
        setUserId(uid);
        const loaded = await fetchEvents();
        setEvents(loaded);
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoadingInit(false);
      }
    };
    init();
  }, []);

  // ── Calendar grid computation ─────────────────────────────────────────────
  const { firstDay, daysInMonth } = useMemo(() => {
    const fd = new Date(year, month, 1).getDay();
    const dim = new Date(year, month + 1, 0).getDate();
    return { firstDay: fd, daysInMonth: dim };
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // ── Add event ─────────────────────────────────────────────────────────────
  const handleAdd = async (key, eventData) => {
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimistic = { ...eventData, id: tempId };
    setEvents(prev => ({ ...prev, [key]: [...(prev[key] || []), optimistic] }));
    setSaving(true);

    if (!supabase || !userId) {
      setSaving(false);
      return; // offline mode — keep in local state
    }

    try {
      const realId = await insertEvent(userId, key, eventData);
      // Replace temp ID with real UUID
      setEvents(prev => ({
        ...prev,
        [key]: prev[key].map(e => e.id === tempId ? { ...e, id: realId } : e),
      }));
    } catch (err) {
      console.error('[Calendar] Insert failed:', err);
      // Rollback optimistic update
      setEvents(prev => ({
        ...prev,
        [key]: (prev[key] || []).filter(e => e.id !== tempId),
      }));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete event ──────────────────────────────────────────────────────────
  const handleDelete = async (key, id) => {
    // Optimistic removal
    setEvents(prev => ({ ...prev, [key]: (prev[key] || []).filter(e => e.id !== id) }));

    if (!supabase || String(id).startsWith('temp-')) return;

    setDeleting(id);
    try {
      await deleteEvent(id);
    } catch (err) {
      console.error('[Calendar] Delete failed:', err);
      // We don't have the event data to rollback cleanly; just log
    } finally {
      setDeleting(null);
    }
  };

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="flex flex-col h-full p-5 overflow-hidden" style={{ color: 'rgba(255,255,255,0.88)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Calendar size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {MONTHS[month]} {year}
            </h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {supabase ? (loadingInit ? 'Syncing with Supabase…' : 'Synced · Supabase') : 'Local mode · No Supabase'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            Today
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={prevMonth}
            className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <ChevronLeft size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={nextMonth}
            className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
          </motion.button>
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          Could not load events: {loadError}
        </div>
      )}

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-2 flex-shrink-0">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-widest py-2"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loadingInit ? (
        <div className="flex-1 flex items-center justify-center gap-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <Loader2 size={22} className="animate-spin" style={{ color: '#818cf8' }} />
          <span className="text-sm">Loading events…</span>
        </div>
      ) : (
        <div className="grid grid-cols-7 flex-1 min-h-0 gap-1 content-start">
          {/* Blank cells before the 1st */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`blank-${i}`} className="rounded-xl" style={{ aspectRatio: undefined, minHeight: 0 }} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const key = dateKey(year, month, day);
            const dayEvents = events[key] || [];
            const isToday = key === todayKey;
            const isSelected = selected === day;

            return (
              <motion.button
                key={day}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelected(day === selected ? null : day)}
                className="relative flex flex-col items-start px-2 py-1.5 rounded-xl text-left overflow-hidden"
                style={{
                  minHeight: 56,
                  background: isSelected
                    ? 'rgba(99,102,241,0.18)'
                    : isToday
                      ? 'rgba(99,102,241,0.08)'
                      : 'rgba(255,255,255,0.03)',
                  border: isSelected
                    ? '1px solid rgba(99,102,241,0.5)'
                    : isToday
                      ? '1px solid rgba(99,102,241,0.25)'
                      : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {/* Day number */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1"
                  style={{
                    background: isToday ? '#6366f1' : 'transparent',
                    color: isToday ? 'white' : isSelected ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  {day}
                </div>

                {/* Event dots (max 3) */}
                <div className="flex flex-col gap-0.5 w-full">
                  {dayEvents.slice(0, 2).map(ev => (
                    <div
                      key={ev.id}
                      className="w-full rounded-sm text-[8px] px-1 truncate leading-4"
                      style={{ background: `${ev.color.bg}25`, color: ev.color.light }}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[8px] px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Event modal */}
      <AnimatePresence>
        {selected !== null && (
          <EventModal
            date={selected}
            year={year}
            month={month}
            events={events}
            userId={userId}
            onClose={() => setSelected(null)}
            onAdd={handleAdd}
            onDelete={handleDelete}
            saving={saving}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalendarApp;
