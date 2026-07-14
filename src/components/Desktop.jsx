/**
 * Desktop.jsx
 * The root OS shell. Renders a dynamic wallpaper bound to userPrefs.wallpaper_url,
 * all open WindowFrame instances, and the bottom-docked Taskbar.
 */
import { AnimatePresence } from 'framer-motion';
import useOSStore from '../store/osStore';
import useConfigStore from '../store/configStore';
import WindowFrame from './WindowFrame';
import Taskbar from './Taskbar';
import SystemDiagnostic from '../apps/SystemDiagnostic';
import SettingsApp from '../apps/SettingsApp';
import TextEditorApp from '../apps/TextEditorApp';

// Registry that maps componentName slugs → actual React components
const APP_COMPONENT_MAP = {
  'system-diagnostic': SystemDiagnostic,
  'settings':          SettingsApp,
  'text-editor':        TextEditorApp,
  // Future apps registered here
};

// Window position cascade — each new window opens offset from the previous
const CASCADE_OFFSET = 32;
const getDefaultPosition = (index) => ({
  x: 110 + index * CASCADE_OFFSET,
  y: 70  + index * CASCADE_OFFSET,
});

const Desktop = () => {
  const { windows } = useOSStore();
  const { userPrefs } = useConfigStore();

  // Build background: prefer wallpaper_url if set, fall back to gradient
  const wallpaperStyle = userPrefs.wallpaper_url
    ? {
        backgroundImage: `url("${userPrefs.wallpaper_url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : {
        background: `
          radial-gradient(ellipse at 20% 10%, rgba(99,  58, 183, 0.45) 0%, transparent 55%),
          radial-gradient(ellipse at 80% 15%, rgba(20, 120, 200, 0.38) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(30,  30,  60, 0.9)  0%, transparent 70%),
          linear-gradient(145deg, #07071a 0%, #0d0d28 40%, #0a0a1e 100%)
        `,
      };

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none"
      style={wallpaperStyle}
    >
      {/* ── Subtle dark overlay when using a photo wallpaper ── */}
      {userPrefs.wallpaper_url && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.25)' }}
        />
      )}

      {/* ── Subtle noise/grain texture overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
          opacity: 0.45,
        }}
      />

      {/* ── Open Windows ── */}
      <AnimatePresence>
        {windows.map((win, index) => {
          const AppComponent = APP_COMPONENT_MAP[win.componentName];
          const pos = getDefaultPosition(index);

          if (!win.isOpen) return null;

          return (
            <WindowFrame
              key={win.id}
              windowId={win.id}
              title={win.title}
              isMinimized={win.isMinimized}
              isMaximized={win.isMaximized}
              zIndex={win.zIndex}
              defaultX={pos.x}
              defaultY={pos.y}
              defaultWidth={win.componentName === 'settings' ? 780 : 700}
              defaultHeight={
                win.componentName === 'settings'     ? 540 :
                win.componentName === 'text-editor'  ? 540 :
                490
              }
            >
              {AppComponent
                ? <AppComponent />
                : (
                  <div className="flex items-center justify-center h-full text-white/30 text-sm">
                    No component registered for "{win.componentName}"
                  </div>
                )
              }
            </WindowFrame>
          );
        })}
      </AnimatePresence>

      {/* ── Taskbar ── */}
      <Taskbar />
    </div>
  );
};

export default Desktop;
