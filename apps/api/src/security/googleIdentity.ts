import { createClient } from '@supabase/supabase-js';
import { HttpError } from '../http/errorResponder';

// The mobile app signs in through Supabase OAuth, so verify its session with
// the configured project's Auth server. Never trust client-supplied profiles.
export async function verifyGoogleIdentity(accessToken: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, 'Google sign-in is not configured.');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  const user = data?.user;
  const identity = user?.identities?.find(item => item.provider === 'google');
  const email = user?.email?.trim().toLowerCase();
  if (error || !user?.email_confirmed_at || !email || !identity ||
      identity.identity_data?.email_verified !== true ||
      identity.identity_data?.email?.toLowerCase() !== email) {
    throw new HttpError(401, 'Google authentication could not be verified.');
  }
  return { id: identity.id, email,
    name: String(identity.identity_data?.full_name || identity.identity_data?.name || email.split('@')[0]).slice(0, 50),
    avatarUrl: typeof identity.identity_data?.avatar_url === 'string' ? identity.identity_data.avatar_url : null,
    canLinkByEmail: email.endsWith('@gmail.com'),
  };
}
