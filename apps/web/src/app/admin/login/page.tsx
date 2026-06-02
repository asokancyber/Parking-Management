'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, auth, errorMessage, isApiError, type ApiError } from '@/lib/api';

type LoginResp = {
  token: string;
  user: { id: string; email: string; role: string; fullName: string };
};

// Pre-checks the API on mount so we can show "backend is down" *before* the
// user types and hits submit. Saves the "Failed to fetch" mystery.
type ApiStatus = 'checking' | 'ok' | 'down' | 'unhealthy';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@parksphere.local');
  const [password, setPassword] = useState('parksphere-admin');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    void checkApi();
    const t = setInterval(checkApi, 5000);
    return () => clearInterval(t);
  }, []);

  async function checkApi() {
    try {
      const h = await api<{ ok: boolean }>('/health', { auth: false, timeoutMs: 3000 });
      setApiStatus(h.ok ? 'ok' : 'unhealthy');
    } catch {
      setApiStatus('down');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await api<LoginResp>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      if (resp.user.role !== 'ADMIN' && resp.user.role !== 'OPERATOR') {
        setError({ kind: 'http', status: 403, message: 'This account does not have admin access' });
        return;
      }
      auth.set(resp.token);
      router.push('/admin/dashboard');
    } catch (e) {
      if (isApiError(e)) setError(e);
      else setError({ kind: 'http', status: 0, message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-3">
        <ApiStatusBanner status={apiStatus} />

        <form onSubmit={submit} className="panel-strong p-7">
          <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">ParkSphere</div>
          <h1 className="font-display text-2xl mt-1">Operations Sign-in</h1>
          <p className="text-text-muted text-sm mt-2">Restricted to authorised operators.</p>

          <label className="block mt-5 text-xs text-text-secondary">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
            required
          />

          <label className="block mt-4 text-xs text-text-secondary">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
            required
          />

          {error && <ErrorBox error={error} />}

          <button
            type="submit"
            disabled={busy || apiStatus === 'down'}
            className="mt-6 w-full rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet py-3 text-sm font-medium text-black/90 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Enter command center'}
          </button>
          <div className="text-xs text-text-muted mt-4 text-center">
            Seeded admin: <span className="font-mono">admin@parksphere.local</span> /{' '}
            <span className="font-mono">parksphere-admin</span>
          </div>
        </form>
      </div>
    </main>
  );
}

function ApiStatusBanner({ status }: { status: ApiStatus }) {
  if (status === 'ok' || status === 'checking') return null;

  if (status === 'down') {
    return (
      <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-500/40 p-3 text-sm">
        <div className="font-semibold text-rose-200">Backend is not reachable</div>
        <div className="text-text-secondary text-xs mt-1">
          The API at <code className="font-mono">localhost:4000</code> isn't responding. Make sure
          <code className="font-mono"> start.bat</code> is running. If you just changed the schema,
          run <code className="font-mono">doctor.bat</code> then <code className="font-mono">setup.bat</code>.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/40 p-3 text-sm">
      <div className="font-semibold text-amber-200">Backend is up but unhealthy</div>
      <div className="text-text-secondary text-xs mt-1">
        Schema or database check failed. See{' '}
        <Link href={`/admin/diagnostics`} className="underline">diagnostics</Link>{' '}
        or run <code className="font-mono">doctor.bat</code>.
      </div>
    </div>
  );
}

function ErrorBox({ error }: { error: ApiError }) {
  const tone =
    error.kind === 'network' || error.kind === 'timeout'
      ? 'rose'
      : error.kind === 'http' && error.status === 401
        ? 'amber'
        : 'rose';
  return (
    <div
      className={`mt-3 rounded-lg p-3 text-sm ring-1 ${
        tone === 'rose' ? 'bg-rose-500/10 ring-rose-500/30 text-rose-200' : 'bg-amber-500/10 ring-amber-500/30 text-amber-200'
      }`}
    >
      {error.message}
    </div>
  );
}
