export const API_HOST = import.meta.env.VITE_API_HOST || 'http://localhost:3000';
const API_BASE = `${API_HOST}/api`;

function newClientId() {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`; }
}

/** This tab's id. The server echoes it on live pushes, so the tab can tell its own changes from other people's. */
export const ADMIN_CLIENT_ID = newClientId();

function getToken(): string {
  return localStorage.getItem('ecobud_admin_token') || '';
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    'X-Admin-Client': ADMIN_CLIENT_ID,
  };
}

function formHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    'X-Admin-Client': ADMIN_CLIENT_ID,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      // ignore
    }

    if (res.status === 401) {
      localStorage.removeItem('ecobud_admin_token');
      localStorage.removeItem('ecobud_admin_user');
      localStorage.removeItem('ecobud_admin_authenticated');
      localStorage.removeItem('ecobud_admin_session_started_at');
      localStorage.removeItem('ecobud_admin_last_activity_at');
      window.location.href = '/';
    }

    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// One store of read answers for the session. Each keeps the raw body, so every caller parses its own copy,
// and the ETag, so a refresh the server answers with 304 costs no body.
//  - fresh (under 15s, not cleared): reads without bypassCache use it instead of asking again;
//  - any age: pages open with it at once and refresh behind it (getLastAdminData);
//  - clearing marks entries stale rather than dropping them, so the next read still asks the server.
interface StoredResponse {
  path: string;
  body: string;
  etag: string | null;
  startedAt: number;
  receivedAt: number;
  stale: boolean;
}

const FRESH_MS = 15_000;
const MAX_STORED = 120;
const MAX_STORED_CHARS = 2_000_000;
const responses = new Map<string, StoredResponse>();
const inFlightRequests = new Map<string, { promise: Promise<unknown>; startedAt: number }>();

// After this tab changes something, the server pushes that change back to it. Reads the tab made after its
// change finished already include it, so for a short while those answers are reused instead of fetched again.
let lastOwnWriteAt = 0;
let reuseOwnUntil = 0;
const OWN_PUSH_REUSE_MS = 3_000;

const storeKey = (path: string) => `${getToken()}:${path}`;

function remember(key: string, entry: StoredResponse) {
  responses.delete(key);
  responses.set(key, entry);
  while (responses.size > MAX_STORED) {
    const oldest = responses.keys().next().value;
    if (oldest === undefined) break;
    responses.delete(oldest);
  }
}

export function invalidateAdminApiPath(path: string) {
  clearAdminApiCache(path);
}

/** Makes stored answers (all, or those under pathPrefix) stale, so the next read asks the server. */
export function clearAdminApiCache(pathPrefix?: string) {
  for (const entry of responses.values()) {
    if (!pathPrefix || entry.path.startsWith(pathPrefix)) entry.stale = true;
  }
}

/** A push carried only this tab's own changes: reuse what was read after them for a moment. */
export function markOwnChangePush() {
  reuseOwnUntil = Date.now() + OWN_PUSH_REUSE_MS;
}

/** A push carried someone else's change (or an unknown one): every stored answer is out of date. */
export function markForeignChangePush() {
  reuseOwnUntil = 0;
  clearAdminApiCache();
}

/** The answer for path if it is under 15 seconds old and nothing has changed since, or null. */
export function getCachedAdminData<T>(path: string): T | null {
  const entry = responses.get(storeKey(path));
  if (!entry || entry.stale || Date.now() - entry.receivedAt > FRESH_MS) return null;
  return JSON.parse(entry.body) as T;
}

/** The last answer this session received for path, however old, or null. Show it, then refresh. */
export function getLastAdminData<T>(path: string): T | null {
  const entry = responses.get(storeKey(path));
  return entry ? JSON.parse(entry.body) as T : null;
}

export async function adminGet<T>(path: string, options?: { bypassCache?: boolean }): Promise<T> {
  const key = storeKey(path);
  const stored = responses.get(key);

  // Screens clear their own paths before reloading, so staleness is ignored here: what counts is that the
  // answer was read after this tab's change, and that no one else's change has arrived since (which ends reuse).
  if (Date.now() < reuseOwnUntil) {
    if (stored && stored.startedAt >= lastOwnWriteAt) return JSON.parse(stored.body) as T;
    const running = inFlightRequests.get(key);
    if (running && running.startedAt >= lastOwnWriteAt) return running.promise as Promise<T>;
  }

  if (!options?.bypassCache) {
    if (stored && !stored.stale && Date.now() - stored.receivedAt <= FRESH_MS) return JSON.parse(stored.body) as T;
    // Request deduplication: an identical read already on its way is shared unless a fresh read was asked for.
    const running = inFlightRequests.get(key);
    if (running) return running.promise as Promise<T>;
  }

  const startedAt = Date.now();
  // A body worth storing, or a value with nothing to store (204 No Content).
  type ReadResult = { kind: 'body'; body: string; etag: string | null } | { kind: 'data'; data: T };
  const fetchPromise = (async (): Promise<ReadResult> => {
    const headers = authHeaders();
    if (stored?.etag) headers['If-None-Match'] = stored.etag;
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (stored?.etag && res.status === 304) return { kind: 'body', body: stored.body, etag: stored.etag };
    if (!res.ok || res.status === 204) return { kind: 'data', data: await handleResponse<T>(res) };
    return { kind: 'body', body: await res.text(), etag: res.headers.get('ETag') };
  })();
  const parsed = fetchPromise.then(result => result.kind === 'data' ? result.data : JSON.parse(result.body) as T);
  // Callers that share this read still get its error; this only stops an unhandled-rejection report.
  parsed.catch(() => {});
  inFlightRequests.set(key, { promise: parsed, startedAt });
  try {
    const result = await fetchPromise;
    // A newer fresh read for the same path supersedes this one; keep its answer, not this older one.
    if (result.kind === 'body' && inFlightRequests.get(key)?.promise === parsed && result.body.length <= MAX_STORED_CHARS) {
      remember(key, { path, body: result.body, etag: result.etag, startedAt, receivedAt: Date.now(), stale: false });
    }
    return await parsed;
  } finally {
    if (inFlightRequests.get(key)?.promise === parsed) inFlightRequests.delete(key);
  }
}

async function adminWrite<T>(path: string, init: RequestInit): Promise<T> {
  try {
    return await handleResponse<T>(await fetch(`${API_BASE}${path}`, init));
  } finally {
    lastOwnWriteAt = Date.now();
    clearAdminApiCache();
  }
}

export function adminPost<T>(path: string, body: unknown): Promise<T> {
  return adminWrite<T>(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
}

export function adminPut<T>(path: string, body: unknown): Promise<T> {
  return adminWrite<T>(path, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
}

export function adminPatch<T>(path: string, body: unknown): Promise<T> {
  return adminWrite<T>(path, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) });
}

export function adminPostForm<T>(path: string, body: FormData): Promise<T> {
  return adminWrite<T>(path, { method: 'POST', headers: formHeaders(), body });
}

export function adminPutForm<T>(path: string, body: FormData): Promise<T> {
  return adminWrite<T>(path, { method: 'PUT', headers: formHeaders(), body });
}

export function adminDelete(path: string): Promise<void> {
  return adminWrite<void>(path, { method: 'DELETE', headers: authHeaders() });
}

// Saves a file response (PDF, Excel) using the server's filename when it sends one.
export async function adminDownload(path: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return handleResponse<void>(res);
  const blob = await res.blob();
  const match = (res.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match ? match[1] : fallbackFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
