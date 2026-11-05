const BASE = "/api";

let token: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

declare global {
  interface Window {
    __MANTLE_TOKEN__?: string;
  }
}

/** Token: injected by companion into index.html, or fetched from /api/bootstrap in dev. */
export function ensureToken(): Promise<string | null> {
  if (token) return Promise.resolve(token);
  if (window.__MANTLE_TOKEN__) {
    token = window.__MANTLE_TOKEN__;
    return Promise.resolve(token);
  }
  if (!tokenPromise) {
    tokenPromise = fetch(`${BASE}/bootstrap`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { token?: string } | null) => {
        token = j?.token ?? null;
        return token;
      })
      .catch(() => null)
      .finally(() => {
        tokenPromise = null;
      });
  }
  return tokenPromise;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = await ensureToken();
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (t) headers.set("X-Mantle-Token", t);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      /* noop */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
};
