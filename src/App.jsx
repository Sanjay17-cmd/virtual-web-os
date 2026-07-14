/**
 * App.jsx
 * Global session state gatekeeper.
 * Manages the auth lifecycle: loading → locked → authenticated.
 * On login:
 *   1. Fetches / upserts the user's config row (public.user_configs)
 *   2. Fetches all available apps   (public.app_registry)
 *   3. Fetches user's installed apps (public.user_installed_apps)
 */
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Desktop from './components/Desktop';
import LockScreen from './components/LockScreen';
import supabase from './lib/supabaseClient';
import useConfigStore from './store/configStore';

// Default config matching the Supabase schema contract
const DEFAULT_CONFIG = {
  theme: 'dark',
  animations_enabled: true,
  wallpaper_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80',
  ubuntu_sidebar_expanded: true,
};

function App() {
  // 'loading' | 'locked' | 'authenticated'
  const [authState, setAuthState] = useState('loading');
  const { updateUserPrefs, setCurrentUser, fetchAppRegistry, fetchInstalledApps } = useConfigStore();

  // ── Hydrate user config from Supabase ──────────────────────────────────────
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

  // ── Full login sequence: config + app registry + installed apps ────────────
  const handleUserLogin = async (user) => {
    setCurrentUser(user);
    await hydrateConfig(user.id);
    // Fetch in parallel — neither blocks the other
    await Promise.all([
      fetchAppRegistry(supabase),
      fetchInstalledApps(supabase, user.id),
    ]);
  };

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      setAuthState('locked');
      return;
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUserLogin(session.user).then(() => setAuthState('authenticated'));
      } else {
        setAuthState('locked');
      }
    });

    // Listen for auth changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await handleUserLogin(session.user);
          setAuthState('authenticated');
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setAuthState('locked');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mock / bypass login (dev only) ─────────────────────────────────────────
  const handleMockLogin = () => {
    // In offline mode: apply defaults, leave availableApps/installedApps
    // as the static FALLBACK_REGISTRY seeded in configStore
    updateUserPrefs(DEFAULT_CONFIG);
    setCurrentUser({ id: 'mock-user-dev', email: 'dev@virtualos.local' });
    setAuthState('authenticated');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
