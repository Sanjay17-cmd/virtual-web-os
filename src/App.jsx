import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Desktop from './components/Desktop';
import LockScreen from './components/LockScreen';
import supabase from './lib/supabaseClient';
import useConfigStore from './store/configStore';
import { SYSTEM_APPS } from './store/osStore';

// Default config row matching the Supabase schema contract
const DEFAULT_CONFIG = {
  theme: 'dark',
  animations_enabled: true,
  wallpaper_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80',
  ubuntu_sidebar_expanded: true,
};

function App() {
  // 'loading' | 'locked' | 'authenticated'
  const [authState, setAuthState] = useState('loading');
  const { updateUserPrefs, installApp } = useConfigStore();

  // ── Hydrate user config from Supabase ───────────────────────────────────────
  const hydrateConfig = async (userId) => {
    if (!supabase) {
      updateUserPrefs(DEFAULT_CONFIG);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_configs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        updateUserPrefs({
          theme:                   data.theme,
          animations_enabled:      data.animations_enabled,
          wallpaper_url:           data.wallpaper_url,
          ubuntu_sidebar_expanded: data.ubuntu_sidebar_expanded,
        });
      } else {
        const defaults = { user_id: userId, ...DEFAULT_CONFIG };
        await supabase.from('user_configs').upsert(defaults);
        updateUserPrefs(DEFAULT_CONFIG);
      }
    } catch (err) {
      console.error('[VirtualOS] Config hydration error:', err);
      updateUserPrefs(DEFAULT_CONFIG);
    }
  };

  // ── Hydrate installed apps from Supabase ────────────────────────────────────
  // This is called on every login so that installs persist across sessions.
  // System apps are always installed regardless (handled by configStore defaults).
  const hydrateInstalledApps = async (userId) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('user_installed_apps')
        .select('slug')
        .eq('user_id', userId);

      if (error) throw error;

      // Add each Supabase-persisted slug to the local store
      (data ?? []).forEach(row => installApp(row.slug));

      // Also ensure system apps are always written to Supabase
      // (in case this is the user's first ever login)
      const systemSlugs = [...SYSTEM_APPS];
      const existingSlugs = new Set((data ?? []).map(r => r.slug));
      const missing = systemSlugs.filter(s => !existingSlugs.has(s));
      if (missing.length > 0) {
        await supabase.from('user_installed_apps').upsert(
          missing.map(slug => ({ user_id: userId, slug })),
          { onConflict: 'user_id,slug', ignoreDuplicates: true }
        );
      }
    } catch (err) {
      console.error('[VirtualOS] Installed apps hydration error:', err);
    }
  };

  // ── Auth state listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      setAuthState('locked');
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        Promise.all([
          hydrateConfig(session.user.id),
          hydrateInstalledApps(session.user.id),
        ]).then(() => setAuthState('authenticated'));
      } else {
        setAuthState('locked');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await Promise.all([
            hydrateConfig(session.user.id),
            hydrateInstalledApps(session.user.id),
          ]);
          setAuthState('authenticated');
        } else if (event === 'SIGNED_OUT') {
          setAuthState('locked');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Mock / bypass login ─────────────────────────────────────────────────────
  const handleMockLogin = () => {
    updateUserPrefs(DEFAULT_CONFIG);
    setAuthState('authenticated');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: '#07071a' }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {authState === 'locked' ? (
        <motion.div
          key="lock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.4 }}
        >
          <LockScreen onMockLogin={handleMockLogin} />
        </motion.div>
      ) : (
        <motion.div
          key="desktop"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Desktop />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
