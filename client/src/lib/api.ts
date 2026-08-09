const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = 'APP_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TOKENS_KEY = 'mehub.tokens';

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Tokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(TOKENS_KEY);
}

export function friendlyMessage(message: string | undefined, status: number): string {
  if (message) return message;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'Access denied.';
  if (status === 404) return 'Resource not found.';
  if (status >= 500) return 'Server error. Please try again later.';
  return 'Request failed. Please try again.';
}

async function refreshTokens(): Promise<Tokens | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.accessToken) {
      clearTokens();
      return null;
    }
    setTokens({
      accessToken: json.accessToken,
      refreshToken: json.refreshToken,
      expiresAt: json.expiresAt
    });
    return { accessToken: json.accessToken, refreshToken: json.refreshToken, expiresAt: json.expiresAt };
  } catch {
    clearTokens();
    return null;
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const tokens = getTokens();
  const headers = new Headers(init.headers);
  if (tokens && !(init.body instanceof FormData)) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && tokens) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`);
      res = await fetch(`${API_BASE}${path}`, { ...init, headers: retryHeaders });
    }
  }
  return res;
}

export class ApiClient {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await send(path, init);
    } catch {
      throw new ApiError('Unable to connect to the server. Please check your connection.', 0, 'NETWORK_ERROR');
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(friendlyMessage(json?.message, res.status), res.status, json?.code ?? 'APP_ERROR');
    }
    return json as T;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  delete<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  upload<T>(path: string, formData: FormData) {
    return this.request<T>(path, { method: 'POST', body: formData });
  }
}

export const client = new ApiClient();

export function queryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}