/**
 * WindowFrame.jsx
 * A fully reusable, draggable, resizable, glassmorphic window wrapper.
 * Supports Mac-style traffic-light controls, Framer Motion spring animations,
 * bounded drag, and maximized/minimized state transitions.
 */
import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import useOSStore from '../store/osStore';

// Spring config for all window transitions
const SPRING = { type: 'spring', stiffness: 320, damping: 28 };

// Animation variants for window open/close lifecycle
const windowVariants = {
  initial: {
    opacity: 0,
    scale: 0.85,
    y: 60,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: 80,
    transition: { duration: 0.22, ease: 'easeIn' },
  },
  minimized: {
    opacity: 0,
    scale: 0.6,
    y: 120,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

// Maximized layout variants
const maximizedVariants = {
  windowed: {
    top: undefined,
    left: undefined,
    right: undefined,
    bottom: undefined,
    width: undefined,
    height: undefined,
    borderRadius: 12,
    transition: SPRING,
  },
  maximized: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 48,  // above taskbar
    width: '100%',
    height: 'calc(100vh - 48px)',
    borderRadius: 0,
    transition: SPRING,
  },
};

const WindowFrame = ({
  windowId,
  title,
  isMinimized,
  isMaximized,
  zIndex,
  defaultWidth = 720,
  defaultHeight = 500,
  defaultX = 120,
  defaultY = 80,
  children,
}) => {
  const constraintsRef = useRef(null);
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow } = useOSStore();

  return (
    <AnimatePresence>
      {!isMinimized && (
        <motion.div
          key={windowId}
          className="absolute"
          style={{
            zIndex,
            ...(isMaximized
              ? {
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: 'calc(100vh - 48px)',
                  borderRadius: 0,
                }
              : {
                  width: defaultWidth,
                  height: defaultHeight,
                  top: defaultY,
                  left: defaultX,
                  borderRadius: 12,
                }),
          }}
          variants={windowVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          drag={!isMaximized}
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={{
            top: 0,
            left: 0,
            right: window.innerWidth - defaultWidth,
            bottom: window.innerHeight - defaultHeight - 48,
          }}
          onMouseDown={() => focusWindow(windowId)}
          whileDrag={{ boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        >
          {/* ── Glassmorphic Window Shell ── */}
          <div
            className="flex flex-col w-full h-full overflow-hidden"
            style={{
              borderRadius: isMaximized ? 0 : 12,
              background: 'rgba(18, 18, 28, 0.78)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            {/* ── Title Bar ── */}
            <div
              className="flex items-center gap-2 px-4 select-none"
              style={{
                height: 44,
                minHeight: 44,
                background: 'rgba(255,255,255,0.035)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                cursor: isMaximized ? 'default' : 'grab',
              }}
            >
              {/* Mac-style Traffic Lights */}
              <div className="flex items-center gap-[7px] mr-2">
                {/* Close — Red */}
                <button
                  className="group w-3 h-3 rounded-full flex items-center justify-center transition-all duration-150"
                  style={{ background: '#ff5f57', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
                  onClick={(e) => { e.stopPropagation(); closeWindow(windowId); }}
                  title="Close"
                >
                  <X size={7} className="opacity-0 group-hover:opacity-100 text-red-900 transition-opacity" strokeWidth={3} />
                </button>

                {/* Minimize — Yellow */}
                <button
                  className="group w-3 h-3 rounded-full flex items-center justify-center transition-all duration-150"
                  style={{ background: '#febc2e', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
                  onClick={(e) => { e.stopPropagation(); minimizeWindow(windowId); }}
                  title="Minimize"
                >
                  <Minus size={7} className="opacity-0 group-hover:opacity-100 text-yellow-900 transition-opacity" strokeWidth={3} />
                </button>

                {/* Maximize — Green */}
                <button
                  className="group w-3 h-3 rounded-full flex items-center justify-center transition-all duration-150"
                  style={{ background: '#28c840', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
                  onClick={(e) => { e.stopPropagation(); maximizeWindow(windowId); }}
                  title={isMaximized ? 'Restore' : 'Maximize'}
                >
                  {isMaximized
                    ? <Minimize2 size={7} className="opacity-0 group-hover:opacity-100 text-green-900 transition-opacity" strokeWidth={3} />
                    : <Maximize2 size={7} className="opacity-0 group-hover:opacity-100 text-green-900 transition-opacity" strokeWidth={3} />
                  }
                </button>
              </div>

              {/* Window Title */}
              <span
                className="flex-1 text-center text-sm font-medium pointer-events-none"
                style={{ color: 'rgba(255,255,255,0.65)', letterSpacing: '0.01em' }}
              >
                {title}
              </span>

              {/* Right spacer to balance title */}
              <div style={{ width: 62 }} />
            </div>

            {/* ── App Content Area ── */}
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
