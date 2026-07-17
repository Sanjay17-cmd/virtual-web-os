/**
 * WindowFrame.jsx
 * A fully reusable, draggable, resizable, glassmorphic window wrapper.
 *
 * Drag fix: Framer Motion drag uses TRANSLATE (x/y offset from initial position).
 * We no longer use top/left CSS for position — instead the window starts at
 * (defaultX, defaultY) via `style.x` / `style.y` on the motion.div, and
 * dragConstraints bound it inside [0, viewport - window size].
 * This eliminates the "invisible wall" caused by mixing CSS top/left with
 * Framer drag coordinates.
 *
 * Tiling: Right-click the title bar to get a tiling context menu.
 * Tiles snap the window to half-screen, thirds, or quarter positions.
 * Tiling is applied by reading the tile layout stored in the osStore window entry.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { X, Minus, Maximize2, Minimize2, LayoutTemplate } from 'lucide-react';
import useOSStore from '../store/osStore';

// Spring config
const SPRING = { type: 'spring', stiffness: 320, damping: 28 };

// Taskbar height (leave room so windows don't go under it)
const TASKBAR_H = 48;

// ── Tiling layouts available via right-click context menu ────────────────────
// Each layout function receives (vw, vh) and returns { x, y, w, h }
export const TILE_LAYOUTS = [
  {
    id: 'left-half',
    label: '⬛ Left Half',
    shortcut: 'Win+←',
    fn: (vw, vh) => ({ x: 0, y: 0, w: Math.floor(vw / 2), h: vh - TASKBAR_H }),
  },
  {
    id: 'right-half',
    label: '⬛ Right Half',
    shortcut: 'Win+→',
    fn: (vw, vh) => ({ x: Math.floor(vw / 2), y: 0, w: Math.ceil(vw / 2), h: vh - TASKBAR_H }),
  },
  {
    id: 'top-half',
    label: '⬛ Top Half',
    shortcut: 'Win+↑',
    fn: (vw, vh) => ({ x: 0, y: 0, w: vw, h: Math.floor((vh - TASKBAR_H) / 2) }),
  },
  {
    id: 'bottom-half',
    label: '⬛ Bottom Half',
    shortcut: 'Win+↓',
    fn: (vw, vh) => ({ x: 0, y: Math.floor((vh - TASKBAR_H) / 2), w: vw, h: Math.ceil((vh - TASKBAR_H) / 2) }),
  },
  {
    id: 'left-third',
    label: '▐ Left Third',
    fn: (vw, vh) => ({ x: 0, y: 0, w: Math.floor(vw / 3), h: vh - TASKBAR_H }),
  },
  {
    id: 'center-third',
    label: '▐ Centre Third',
    fn: (vw, vh) => ({ x: Math.floor(vw / 3), y: 0, w: Math.floor(vw / 3), h: vh - TASKBAR_H }),
  },
  {
    id: 'right-third',
    label: '▐ Right Third',
    fn: (vw, vh) => ({ x: Math.floor((vw / 3) * 2), y: 0, w: Math.ceil(vw / 3), h: vh - TASKBAR_H }),
  },
  {
    id: 'top-left',
    label: '◰ Top Left',
    fn: (vw, vh) => ({ x: 0, y: 0, w: Math.floor(vw / 2), h: Math.floor((vh - TASKBAR_H) / 2) }),
  },
  {
    id: 'top-right',
    label: '◳ Top Right',
    fn: (vw, vh) => ({ x: Math.floor(vw / 2), y: 0, w: Math.ceil(vw / 2), h: Math.floor((vh - TASKBAR_H) / 2) }),
  },
  {
    id: 'bottom-left',
    label: '◲ Bottom Left',
    fn: (vw, vh) => ({ x: 0, y: Math.floor((vh - TASKBAR_H) / 2), w: Math.floor(vw / 2), h: Math.ceil((vh - TASKBAR_H) / 2) }),
  },
  {
    id: 'bottom-right',
    label: '◱ Bottom Right',
    fn: (vw, vh) => ({
      x: Math.floor(vw / 2),
      y: Math.floor((vh - TASKBAR_H) / 2),
      w: Math.ceil(vw / 2),
      h: Math.ceil((vh - TASKBAR_H) / 2),
    }),
  },
  {
    id: 'center',
    label: '⊡ Centre (80%)',
    fn: (vw, vh) => ({
      x: Math.floor(vw * 0.1),
      y: Math.floor((vh - TASKBAR_H) * 0.05),
      w: Math.floor(vw * 0.8),
      h: Math.floor((vh - TASKBAR_H) * 0.9),
    }),
  },
];

// ── Tiling context menu ───────────────────────────────────────────────────────
const TileMenu = ({ onSelect, onClose }) => {
  const groups = [
    { label: 'Halves', ids: ['left-half', 'right-half', 'top-half', 'bottom-half'] },
    { label: 'Thirds', ids: ['left-third', 'center-third', 'right-third'] },
    { label: 'Quarters', ids: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    { label: 'Other',  ids: ['center'] },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ duration: 0.12 }}
      className="absolute top-10 right-2 z-[99999] rounded-xl overflow-hidden"
      style={{
        background: 'rgba(10,10,22,0.98)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        minWidth: 200,
      }}
      onClick={e => e.stopPropagation()}
    >
      {groups.map((g, gi) => (
        <div key={g.label}>
          {gi > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />}
          <p className="text-[9px] font-semibold uppercase tracking-widest px-3 pt-2 pb-0.5"
            style={{ color: 'rgba(255,255,255,0.25)' }}>{g.label}</p>
          {g.ids.map(id => {
            const layout = TILE_LAYOUTS.find(l => l.id === id);
            return (
              <button
                key={id}
                onClick={() => { onSelect(id); onClose(); }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.72)' }}
              >
                <span>{layout.label}</span>
                {layout.shortcut && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
                    {layout.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />
      <button
        onClick={() => { onSelect(null); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        ✕ Float (restore)
      </button>
      <div className="h-2" />
    </motion.div>
  );
};

// ── Main WindowFrame ──────────────────────────────────────────────────────────
const WindowFrame = ({
  windowId,
  title,
  isMinimized,
  isMaximized,
  tileLayout,       // string tile id or null
  zIndex,
  defaultWidth = 720,
  defaultHeight = 500,
  defaultX = 120,
  defaultY = 80,
  children,
}) => {
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, tileWindow } = useOSStore();
  const [showTileMenu, setShowTileMenu] = useState(false);

  // Framer Motion translate values — this is how drag works correctly
  // (position = initial CSS top/left + translate x/y from drag)
  const motionX = useMotionValue(0);
  const motionY = useMotionValue(0);

  // Compute tile rect when a tile layout is active
  const tileRect = tileLayout
    ? TILE_LAYOUTS.find(l => l.id === tileLayout)?.fn(window.innerWidth, window.innerHeight)
    : null;

  // Reset drag offset when tiling is applied (so the window snaps cleanly)
  useEffect(() => {
    if (tileRect) {
      motionX.set(0);
      motionY.set(0);
    }
  }, [tileRect, motionX, motionY]);

  // Close tile menu on outside click
  useEffect(() => {
    if (!showTileMenu) return;
    const handler = () => setShowTileMenu(false);
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showTileMenu]);

  // Keyboard tiling shortcuts (Win = Meta key)
  useEffect(() => {
    const handler = (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const focused = document.activeElement?.closest(`[data-window-id="${windowId}"]`);
      if (!focused) return;
      const map = {
        ArrowLeft:  'left-half',
        ArrowRight: 'right-half',
        ArrowUp:    'top-half',
        ArrowDown:  'bottom-half',
      };
      if (map[e.key]) {
        e.preventDefault();
        tileWindow(windowId, map[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [windowId, tileWindow]);

  // Determine actual render position/size
  const isActuallyMaximized = isMaximized && !tileRect;
  const computedStyle = (() => {
    if (isActuallyMaximized) {
      return {
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw',
        height: `calc(100vh - ${TASKBAR_H}px)`,
        borderRadius: 0,
      };
    }
    if (tileRect) {
      return {
        position: 'fixed',
        top: tileRect.y,
        left: tileRect.x,
        width: tileRect.w,
        height: tileRect.h,
        borderRadius: 6,
      };
    }
    return {
      position: 'absolute',
      top: defaultY,
      left: defaultX,
      width: defaultWidth,
      height: defaultHeight,
      borderRadius: 12,
    };
  })();

  const canDrag = !isActuallyMaximized && !tileRect;

  return (
    <AnimatePresence>
      {!isMinimized && (
        <motion.div
          key={windowId}
          data-window-id={windowId}
          className="overflow-hidden"
          style={{
            ...computedStyle,
            zIndex,
            x: canDrag ? motionX : 0,
            y: canDrag ? motionY : 0,
          }}
          initial={{ opacity: 0, scale: 0.86, y: (computedStyle.y ?? 0) + 60 }}
          animate={{ opacity: 1, scale: 1, y: computedStyle.y ?? 0 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.18, ease: 'easeIn' } }}
          transition={SPRING}
          drag={canDrag}
          dragMomentum={false}
          dragElastic={0}
          // ── KEY FIX: dragConstraints tells Framer the translate (x/y) bounds.
          // Since the element starts at (defaultX, defaultY) via CSS top/left,
          // the allowed translate range is:
          //   left: -defaultX (can go to x=0)
          //   right: viewport_w - defaultX - windowW (can go to right edge)
          //   top: -defaultY (can go to y=0)
          //   bottom: viewport_h - defaultY - windowH - TASKBAR_H
          dragConstraints={canDrag ? {
            left:   -defaultX,
            top:    -defaultY,
            right:  Math.max(0, window.innerWidth  - defaultX - defaultWidth),
            bottom: Math.max(0, window.innerHeight - defaultY - defaultHeight - TASKBAR_H),
          } : false}
          onMouseDown={() => focusWindow(windowId)}
          whileDrag={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65)', scale: 1.002 }}
        >
          {/* ── Glassmorphic Window Shell ── */}
          <div
            className="flex flex-col w-full h-full"
            style={{
              borderRadius: computedStyle.borderRadius,
              background: 'rgba(18, 18, 28, 0.82)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
              overflow: 'hidden',
            }}
          >
            {/* ── Title Bar ── */}
            <div
              className="flex items-center gap-2 px-4 select-none relative flex-shrink-0"
              style={{
                height: 44,
                minHeight: 44,
                background: 'rgba(255,255,255,0.035)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                cursor: canDrag ? 'grab' : 'default',
              }}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setShowTileMenu(v => !v); }}
            >
              {/* Traffic Lights */}
              <div className="flex items-center gap-[7px] mr-2 flex-shrink-0">
                <button
                  className="group w-3 h-3 rounded-full flex items-center justify-center transition-all"
                  style={{ background: '#ff5f57', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
                  onClick={e => { e.stopPropagation(); closeWindow(windowId); }}
                  title="Close"
                >
                  <X size={7} className="opacity-0 group-hover:opacity-100 text-red-900" strokeWidth={3} />
                </button>
                <button
                  className="group w-3 h-3 rounded-full flex items-center justify-center transition-all"
                  style={{ background: '#febc2e', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
                  onClick={e => { e.stopPropagation(); minimizeWindow(windowId); }}
                  title="Minimize"
                >
                  <Minus size={7} className="opacity-0 group-hover:opacity-100 text-yellow-900" strokeWidth={3} />
                </button>
                <button
                  className="group w-3 h-3 rounded-full flex items-center justify-center transition-all"
                  style={{ background: '#28c840', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
                  onClick={e => { e.stopPropagation(); maximizeWindow(windowId); }}
                  title={isActuallyMaximized ? 'Restore' : 'Maximise'}
                >
                  {isActuallyMaximized
                    ? <Minimize2 size={7} className="opacity-0 group-hover:opacity-100 text-green-900" strokeWidth={3} />
                    : <Maximize2 size={7} className="opacity-0 group-hover:opacity-100 text-green-900" strokeWidth={3} />
                  }
                </button>
              </div>

              {/* Title */}
              <span
                className="flex-1 text-center text-sm font-medium pointer-events-none truncate"
                style={{ color: 'rgba(255,255,255,0.65)', letterSpacing: '0.01em' }}
              >
                {title}
                {tileRect && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', verticalAlign: 'middle' }}>
                    Tiled
                  </span>
                )}
              </span>

              {/* Right: tiling button + spacer */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); setShowTileMenu(v => !v); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
                  title="Tile window (also: right-click title bar)"
                  style={{ background: showTileMenu ? 'rgba(99,102,241,0.25)' : 'transparent' }}
                >
                  <LayoutTemplate size={11} style={{ color: showTileMenu ? '#a5b4fc' : 'rgba(255,255,255,0.8)' }} />
                </button>
                <div style={{ width: 48 }} />
              </div>

              {/* Tiling context menu */}
              <AnimatePresence>
                {showTileMenu && (
                  <TileMenu
                    onSelect={layoutId => tileWindow(windowId, layoutId)}
                    onClose={() => setShowTileMenu(false)}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* ── App Content ── */}
            <div className="flex-1 overflow-auto" style={{ color: 'rgba(255,255,255,0.88)' }}>
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WindowFrame;
