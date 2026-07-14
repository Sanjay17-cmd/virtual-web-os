/**
 * CalendarApp.jsx
 * A clean monthly calendar mini-app for the Virtual OS.
 * Features: month navigation, today highlight, event markers, and an event list panel.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, Plus, X } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// Small set of default events so the calendar isn't empty on first open
const DEFAULT_EVENTS = (() => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  return [
    { id: 1, date: `${y}-${String(m+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`, title: 'Today — get things done 🚀', color: '#6366f1' },
    { id: 2, date: `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(today.getDate()+2,28)).padStart(2,'0')}`, title: 'Team standup', color: '#06b6d4' },
    { id: 3, date: `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(today.getDate()+5,28)).padStart(2,'0')}`, title: 'Product review', color: '#8b5cf6' },
  ];
})();

const fmt = (y, m, d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

const CalendarApp = () => {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected,  setSelected]  = useState(fmt(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events,    setEvents]    = useState(DEFAULT_EVENTS);
  const [newTitle,  setNewTitle]  = useState('');

  // Build calendar grid
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = fmt(today.getFullYear(), today.getMonth(), today.getDate());
  const eventMap = events.reduce((acc, ev) => {
    (acc[ev.date] = acc[ev.date] ?? []).push(ev);
    return acc;
  }, {});

  const navMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setViewMonth(m); setViewYear(y);
  };

  const addEvent = () => {
    if (!newTitle.trim()) return;
    setEvents(prev => [...prev, {
      id: Date.now(),
      date: selected,
      title: newTitle.trim(),
      color: ['#6366f1','#06b6d4','#10b981','#f59e0b','#ec4899'][Math.floor(Math.random()*5)],
    }]);
    setNewTitle('');
  };

  const removeEvent = (id) => setEvents(prev => prev.filter(e => e.id !== id));

  const selectedEvents = eventMap[selected] ?? [];

  return (
    <div
      className="flex h-full overflow-hidden gap-0"
      style={{ color: 'rgba(255,255,255,0.88)' }}
    >
      {/* ── Left: Calendar grid ── */}
      <div className="flex flex-col flex-1 p-6 min-w-0">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Calendar size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Calendar</h1>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => navMonth(-1)}
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              <ChevronLeft size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </motion.button>
            <div className="text-xs font-semibold min-w-[108px] text-center" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => navMonth(1)}
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </motion.button>
          </div>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold py-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const dateStr  = fmt(viewYear, viewMonth, day);
            const isToday  = dateStr === todayStr;
            const isSel    = dateStr === selected;
            const hasEvents = (eventMap[dateStr]?.length ?? 0) > 0;
            const dots     = eventMap[dateStr] ?? [];

            return (
              <motion.button
                key={dateStr}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelected(dateStr)}
                className="flex flex-col items-center justify-start pt-1.5 pb-1 px-0.5 rounded-xl relative"
                style={{
                  background: isSel
                    ? 'rgba(99,102,241,0.25)'
                    : isToday
                    ? 'rgba(99,102,241,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  border: isSel
                    ? '1px solid rgba(99,102,241,0.5)'
                    : isToday
                    ? '1px solid rgba(99,102,241,0.2)'
                    : '1px solid transparent',
                  minHeight: 44,
                }}
              >
                <span
                  className="text-xs font-semibold leading-none"
                  style={{
                    color: isSel ? '#a5b4fc' : isToday ? '#818cf8' : 'rgba(255,255,255,0.75)',
                  }}
                >
                  {day}
                </span>
                {/* Event dots */}
                {hasEvents && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {dots.slice(0, 3).map((ev, di) => (
                      <div
                        key={di}
                        className="w-1 h-1 rounded-full"
                        style={{ background: ev.color }}
                      />
                    ))}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Event panel ── */}
      <div
        className="w-52 flex-shrink-0 flex flex-col p-4 gap-4 overflow-hidden"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {selected === todayStr ? "Today's events" : `Events on ${selected.slice(5).replace('-', '/')}`}
          </p>

          {/* Event list */}
          <div className="space-y-2 mt-2">
            <AnimatePresence>
              {selectedEvents.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-xs py-4 text-center"
                  style={{ color: 'rgba(255,255,255,0.22)' }}
                >
                  No events
                </motion.p>
              ) : (
                selectedEvents.map(ev => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-start gap-2 p-2.5 rounded-xl group"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                      style={{ background: ev.color }}
                    />
                    <span className="text-xs flex-1 leading-snug" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {ev.title}
                    </span>
                    <button
                      onClick={() => removeEvent(ev.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      <X size={11} />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Add event */}
        <div className="mt-auto space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Add Event
          </p>
          <input
            type="text"
            placeholder="Event title…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEvent()}
            className="w-full text-xs bg-transparent outline-none px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(255,255,255,0.8)',
            }}
          />
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={addEvent}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.35)',
              color: '#a5b4fc',
            }}
          >
            <Plus size={12} />
            Add
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default CalendarApp;
