// SECURITY: the admin and moderator session lives in sessionStorage, which the browser clears when
// the tab or window closes. Open dashboard tabs hand the session to a new tab over a BroadcastChannel,
// so once every tab is closed nobody is left to hand it over and the next visit shows the login screen.
// The channel only reaches tabs of this same site in this same browser profile.
// Closing the tabs does not end the session on the server right away: a copied token keeps working
// until the API's 35-minute idle limit. Logout and the dashboard's timeouts end it at once.
const TOKEN_KEY = 'ecobud_admin_token';
const USER_KEY = 'ecobud_admin_user';
const AUTHENTICATED_KEY = 'ecobud_admin_authenticated';
const STARTED_KEY = 'ecobud_admin_session_started_at';
const LAST_ACTIVITY_KEY = 'ecobud_admin_last_activity_at';
const SESSION_KEYS = [TOKEN_KEY, USER_KEY, AUTHENTICATED_KEY, STARTED_KEY, LAST_ACTIVITY_KEY];

type SharedSession = { token: string; user: string; startedAt: number; lastActivityAt: number };
export type SignOutReason = 'logout' | 'expired' | 'rejected';
export type AdminSessionChange = { kind: 'signed-in' } | { kind: 'signed-out'; reason: SignOutReason };
type SessionMessage =
  | { type: 'request'; id: string }
  | { type: 'share'; id: string; session: SharedSession }
  | { type: 'signed-in'; session: SharedSession }
  | { type: 'activity'; at: number }
  | { type: 'signed-out'; reason: SignOutReason; token?: string };

// Older browsers without BroadcastChannel fall back to one login per tab.
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ecobud-admin-session');
const pendingRequests = new Map<string, (session: unknown) => void>();
const listeners = new Set<(change: AdminSessionChange) => void>();

export function getAdminToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

/** The signed-in user as stored at login (JSON text), or null when signed out. */
export function getAdminUserJson(): string | null {
  return sessionStorage.getItem(USER_KEY);
}

export function hasAdminCredentials(): boolean {
  return Boolean(sessionStorage.getItem(TOKEN_KEY) && sessionStorage.getItem(AUTHENTICATED_KEY) === 'true');
}

export function getAdminSessionTimes() {
  return {
    startedAt: Number(sessionStorage.getItem(STARTED_KEY)),
    lastActivityAt: Number(sessionStorage.getItem(LAST_ACTIVITY_KEY)),
  };
}

function readSession(): SharedSession | null {
  const user = getAdminUserJson();
  const { startedAt, lastActivityAt } = getAdminSessionTimes();
  if (!hasAdminCredentials() || !user || !startedAt || !lastActivityAt) return null;
  return { token: getAdminToken(), user, startedAt, lastActivityAt };
}

function writeSession(session: SharedSession) {
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, session.user);
  sessionStorage.setItem(AUTHENTICATED_KEY, 'true');
  sessionStorage.setItem(STARTED_KEY, String(session.startedAt));
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(session.lastActivityAt));
}

function isSharedSession(value: unknown): value is SharedSession {
  const session = value as SharedSession | null;
  return typeof session?.token === 'string' && session.token.length > 0 && typeof session.user === 'string'
    && Number.isFinite(session.startedAt) && Number.isFinite(session.lastActivityAt);
}

function notify(change: AdminSessionChange) {
  listeners.forEach(listener => listener(change));
}

function post(message: SessionMessage) {
  channel?.postMessage(message);
}

channel?.addEventListener('message', (event: MessageEvent<SessionMessage>) => {
  const message = event.data;
  switch (message?.type) {
    case 'request': {
      const session = readSession();
      if (session) post({ type: 'share', id: message.id, session });
      break;
    }
    case 'share':
      pendingRequests.get(message.id)?.(message.session);
      break;
    case 'signed-in':
      // A login in another tab also signs in tabs that are sitting on the login screen.
      if (!hasAdminCredentials() && isSharedSession(message.session)) {
        writeSession(message.session);
        notify({ kind: 'signed-in' });
      }
      break;
    case 'activity':
      // Activity in any tab counts for all of them, so a quiet tab does not hit the idle limit
      // and sign out the tab that is being used.
      if (hasAdminCredentials() && message.at > getAdminSessionTimes().lastActivityAt) {
        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(message.at));
      }
      break;
    case 'signed-out':
      if (hasAdminCredentials() && (!message.token || message.token === getAdminToken())) {
        clearAdminSession();
        notify({ kind: 'signed-out', reason: message.reason });
      }
      break;
  }
});

/** Called by a new tab: asks open dashboard tabs for their session. Resolves true when one answered. */
export function requestSharedAdminSession(timeoutMs = 300): Promise<boolean> {
  if (!channel) return Promise.resolve(false);
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return new Promise(resolve => {
    const timer = window.setTimeout(() => {
      pendingRequests.delete(id);
      resolve(false);
    }, timeoutMs);
    // The first tab to answer wins; later answers find no pending request and are ignored.
    pendingRequests.set(id, session => {
      window.clearTimeout(timer);
      pendingRequests.delete(id);
      if (!isSharedSession(session)) return resolve(false);
      writeSession(session);
      resolve(true);
    });
    post({ type: 'request', id });
  });
}

export function onAdminSessionChange(listener: (change: AdminSessionChange) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function saveAdminSession(token: string, user: unknown) {
  const now = Date.now();
  const session = { token, user: JSON.stringify(user), startedAt: now, lastActivityAt: now };
  writeSession(session);
  post({ type: 'signed-in', session });
}

export function recordAdminActivity(at: number) {
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  post({ type: 'activity', at });
}

/** Clears this tab only. Used on page load when the stored session is missing or too old. */
export function clearAdminSession() {
  SESSION_KEYS.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Clears this tab and tells the other tabs to sign out.
 * 'all': logout and timeouts end the session in every tab.
 * 'same-token': a 401 only ends tabs using the token the server rejected.
 */
export function signOutAdminTabs(scope: 'all' | 'same-token', reason: SignOutReason) {
  const token = getAdminToken();
  clearAdminSession();
  if (scope === 'all') post({ type: 'signed-out', reason });
  else if (token) post({ type: 'signed-out', reason, token });
}

// Older builds kept the session in localStorage. Remove it so nobody stays signed in from before.
export function removeLegacyAdminSession() {
  SESSION_KEYS.forEach(key => localStorage.removeItem(key));
}
