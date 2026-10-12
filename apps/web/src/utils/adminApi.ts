export const API_HOST = import.meta.env.VITE_API_HOST || 'http://localhost:3000';
const API_BASE = `${API_HOST}/api`;

function getToken(): string {
  return localStorage.getItem('ecobud_admin_token') || '';
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 15_000;

// Last body received per read, kept as text so each caller gets its own parsed copy.
// It outlives clearAdminApiCache on purpose: a refresh still asks the server, which
// answers 304 with no body when nothing changed.
const CONDITIONAL_READ_MAX_ENTRIES = 80;
const CONDITIONAL_READ_MAX_CHARS = 1_000_000;
const conditionalReads = new Map<string, { etag: string; body: string }>();

export function invalidateAdminApiPath(path: string) {
  clearAdminApiCache(path);
}

export function clearAdminApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(pathPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function getCachedAdminData<T>(path: string): T | null {
  const entry = memoryCache.get(path);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(path);
    return null;
  }
  return entry.data as T;
}

export async function adminGet<T>(path: string, options?: { bypassCache?: boolean }): Promise<T> {
  if (!options?.bypassCache) {
    const cached = getCachedAdminData<T>(path);
    if (cached !== null) {
      return cached;
    }
  }

  // Request deduplication: if identical path is already in flight, reuse it unless a fresh read was requested.
  if (inFlightRequests.has(path) && !options?.bypassCache) {
    return inFlightRequests.get(path)!;
  }

  const fetchPromise = (async () => {
    const readKey = `${getToken()}:${path}`;
    const remembered = conditionalReads.get(readKey);
    const headers = { ...(authHeaders() as Record<string, string>) };
    if (remembered) headers['If-None-Match'] = remembered.etag;
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (remembered && res.status === 304) return JSON.parse(remembered.body) as T;
    if (!res.ok || res.status === 204) return handleResponse<T>(res);
    const body = await res.text();
    const etag = res.headers.get('ETag');
    conditionalReads.delete(readKey);
    if (etag && body.length <= CONDITIONAL_READ_MAX_CHARS) {
      conditionalReads.set(readKey, { etag, body });
      while (conditionalReads.size > CONDITIONAL_READ_MAX_ENTRIES) {
        const oldest = conditionalReads.keys().next().value;
        if (oldest === undefined) break;
        conditionalReads.delete(oldest);
      }
    }
    return JSON.parse(body) as T;
  })();
  inFlightRequests.set(path, fetchPromise);
  try {
    const data = await fetchPromise;
    if (inFlightRequests.get(path) === fetchPromise) memoryCache.set(path, { data, timestamp: Date.now() });
    return data;
  } finally {
    if (inFlightRequests.get(path) === fetchPromise) inFlightRequests.delete(path);
  }
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  clearAdminApiCache();
  return handleResponse<T>(res);
}

export async function adminPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  clearAdminApiCache();
  return handleResponse<T>(res);
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  clearAdminApiCache();
  return handleResponse<T>(res);
}

export async function adminPostForm<T>(path: string, body: FormData): Promise<T> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${getToken()}`,
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  });
  clearAdminApiCache();
  return handleResponse<T>(res);
}

export async function adminPutForm<T>(path: string, body: FormData): Promise<T> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${getToken()}`,
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers,
    body,
  });
  clearAdminApiCache();
  return handleResponse<T>(res);
}

export async function adminDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  clearAdminApiCache();
  return handleResponse<void>(res);
}
