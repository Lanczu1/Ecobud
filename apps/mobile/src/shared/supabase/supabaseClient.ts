import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

const hasSupabaseRealtimeConfig = Boolean(supabaseUrl && supabaseAnonKey);

const supabaseClient = hasSupabaseRealtimeConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })
  : null;

const isSupabaseRealtimeEnabled = () => Boolean(supabaseClient);

export { isSupabaseRealtimeEnabled, supabaseClient };
