import { apiUrl, API_BASE_URL } from './env';
import { handleMock } from './demo/mock-api';

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Discriminated error so UI can render the right message.
export type ApiError =
  | { kind: 'network'; message: string; cause?: unknown }
  | { kind: 'http'; status: number; message: string; body?: unknown }
  | { kind: 'parse'; message: string }
  | { kind: 'timeout'; message: string };

export function isApiError(x: unknown): x is ApiError {
  return !!x && typeof x === 'object' && 'kind' in x && 'message' in x;
}

const tokenKey = 'parksphere.token';

export const auth = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(tokenKey);
  },
  set(token: string) {
    window.localStorage.setItem(tokenKey, token);
  },
  clear() {
    window.localStorage.removeItem(tokenKey);
  },
};

const DEFAULT_TIMEOUT_MS = 10_000;

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  // ─── DEMO MODE — short-circuit to in-memory mock ─────────────────────
  // Lets the Vercel deploy work with zero backend. Routes resolve from
  // src/lib/demo/mock-api.ts using realistic fixture data.
  if (DEMO_MODE) {
    // Tiny artificial latency so loading states actually flash (50-150ms).
    await new Promise((r) => setTimeout(r, 60 + Math.random() * 90));
    const result = handleMock({ path, method: options.method ?? 'GET', body: options.body });
    return result as T;
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.auth !== false) {
    const token = auth.get();
    if (token) headers['authorization'] = `Bearer ${token}`;
  }

  const ctrl = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === 'AbortError') {
      throw {
        kind: 'timeout',
        message: `Request to ${path} timed out after ${timeoutMs}ms. The API may be overloaded or unreachable.`,
      } as ApiError;
    }
    throw {
      kind: 'network',
      message: `Cannot reach the API at ${API_BASE_URL || 'this server'}. Is the backend running? (start.bat / start-docker.bat)`,
      cause: err,
    } as ApiError;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let body: unknown = null;
    let serverMessage = res.statusText || `HTTP ${res.status}`;
    try {
      body = await res.json();
      const b = body as { message?: string | string[]; error?: string };
      if (Array.isArray(b?.message)) serverMessage = b.message.join('; ');
      else if (typeof b?.message === 'string') serverMessage = b.message;
      else if (typeof b?.error === 'string') serverMessage = b.error;
    } catch {
      // ignore — non-JSON body
    }
    throw {
      kind: 'http',
      status: res.status,
      message: humanize(res.status, serverMessage),
      body,
    } as ApiError;
  }

  if (res.status === 204) return undefined as T;

  try {
    return (await res.json()) as T;
  } catch (err) {
    throw {
      kind: 'parse',
      message: `Server returned a malformed response: ${(err as Error).message}`,
    } as ApiError;
  }
}

function humanize(status: number, message: string): string {
  if (status === 401) return 'Invalid credentials';
  if (status === 403) return 'You do not have permission for this action';
  if (status === 404) return message || 'Not found';
  if (status === 409) return message || 'Conflict — the resource already exists';
  if (status === 422 || status === 400) return message || 'Request was rejected by the server';
  if (status >= 500) return message ? `Server error: ${message}` : 'The server hit an unexpected error';
  return message;
}

export function errorMessage(err: unknown): string {
  if (isApiError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}
