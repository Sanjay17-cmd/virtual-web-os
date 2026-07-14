/**
 * LockScreen.jsx
 * Full-screen authentication gate shown before the user logs in.
 * Features a live digital clock, blurred wallpaper backdrop, Google OAuth
 * login, and a local mock-bypass link for offline development.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Zap, Shield } from 'lucide-react';
import supabase from '../lib/supabaseClient';

// ── Live digital clock ────────────────────────────────────────────────────────
const LiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const dateStr = now.toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="text-center mb-12 select-none">
      {/* Large time display */}
      <div
        className="font-bold leading-none tracking-tight"
        style={{
          fontSize: 'clamp(72px, 12vw, 120px)',
          color: 'rgba(255,255,255,0.95)',
          textShadow: '0 0 80px rgba(110,231,247,0.25), 0 4px 32px rgba(0,0,0,0.5)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.03em',
        }}
      >
        {hh}<span style={{ opacity: 0.5, animation: 'blink 1s step-end infinite' }}>:</span>{mm}
      </div>

      {/* Seconds */}
      <div
        className="text-3xl font-light mt-1 tabular-nums"
        style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}
      >
        :{ss}
      </div>

      {/* Date */}
      <div
        className="mt-4 text-base font-medium"
        style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}
      >
        {dateStr}
      </div>
    </div>
  );
};

// ── Google G SVG logo ─────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

// ── Main LockScreen component ─────────────────────────────────────────────────
const LockScreen = ({ onMockLogin }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (!supabase) {
      console.warn('[VirtualOS] Supabase not initialised — use Bypass login for local dev.');
      return;
    }
    setIsLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/drive.file',
        redirectTo: window.location.origin,
      },
    });
    setIsLoading(false);
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 25% 15%, rgba(99,58,183,0.6) 0%, transparent 55%),
          radial-gradient(ellipse at 78% 20%, rgba(20,120,200,0.5) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 85%, rgba(30,30,60,0.95) 0%, transparent 65%),
          linear-gradient(160deg, #04041a 0%, #0b0b26 45%, #070718 100%)
        `,
      }}
    >
      {/* ── Animated background orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          { w: 600, h: 600, x: '-10%', y: '-15%', color: 'rgba(99,102,241,0.12)', dur: '18s' },
          { w: 500, h: 500, x: '65%',  y: '-5%',  color: 'rgba(6,182,212,0.10)',  dur: '22s' },
          { w: 400, h: 400, x: '20%',  y: '55%',  color: 'rgba(139,92,246,0.10)', dur: '26s' },
        ].map((orb, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: orb.w, height: orb.h,
              left: orb.x, top: orb.y,
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
              animation: `float${i} ${orb.dur} ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* ── Noise grain overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
          backgroundSize: '256px',
        }}
      />

      {/* ── Content ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Clock */}
        <LiveClock />

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-5"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: '36px 44px',
            minWidth: 360,
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >
          {/* OS Badge */}
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Shield size={17} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                Virtual OS
              </div>
              <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Secure workspace environment
              </div>
            </div>
          </div>

          <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Google Login button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-xl font-medium text-sm transition-all"
            style={{
              background: isLoading ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
              color: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              cursor: isLoading ? 'wait' : 'pointer',
              minHeight: 48,
            }}
          >
            {isLoading ? (
              <div className="w-5 h-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span>{isLoading ? 'Redirecting…' : 'Continue with Google'}</span>
          </motion.button>

          {/* Bypass / Mock login */}
          <button
            onClick={onMockLogin}
            className="flex items-center gap-1.5 text-xs transition-all hover:opacity-100"
            style={{ color: 'rgba(255,255,255,0.38)', opacity: 0.75 }}
          >
            <Zap size={11} />
            <span>Bypass — Mock Login (dev only)</span>
          </button>
        </motion.div>
      </motion.div>

      {/* CSS keyframes for floating orbs */}
      <style>{`
        @keyframes float0 { from { transform: translate(0,0) scale(1); } to { transform: translate(30px, 20px) scale(1.05); } }
        @keyframes float1 { from { transform: translate(0,0) scale(1); } to { transform: translate(-20px, 30px) scale(1.08); } }
        @keyframes float2 { from { transform: translate(0,0) scale(1); } to { transform: translate(25px,-20px) scale(1.06); } }
        @keyframes blink  { 0%,100% { opacity: 0.5; } 50% { opacity: 0.15; } }
      `}</style>
    </div>
  );
};

export default LockScreen;
