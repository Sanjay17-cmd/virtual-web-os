/**
 * supabaseClient.js
 * Initializes and exports the Supabase client singleton.
 * Gracefully handles missing environment variables during local development:
 * logs a warning but does not crash, exporting a safe null client instead.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[VirtualOS] Supabase env vars are missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).\n' +
    'Running in offline/mock mode. Auth and DB calls will be no-ops.\n' +
    'Fill in .env.local to enable live Supabase features.'
  );
} else {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export default supabase;
