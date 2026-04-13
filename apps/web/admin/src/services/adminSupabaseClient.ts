import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim();

const hasSupabaseRealtimeConfig = Boolean(supabaseUrl && supabaseAnonKey);

const adminSupabaseClient = hasSupabaseRealtimeConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })
  : null;

const isAdminSupabaseRealtimeEnabled = () => Boolean(adminSupabaseClient);

export { adminSupabaseClient, isAdminSupabaseRealtimeEnabled };
