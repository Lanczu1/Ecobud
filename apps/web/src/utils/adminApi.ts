export const API_HOST = 'http://localhost:3000';
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
      window.location.href = '/';
    }

    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleResponse<T>(res);
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function adminPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
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
  return handleResponse<T>(res);
}

export async function adminDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse<void>(res);
}
