'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, auth, errorMessage, isApiError } from '@/lib/api';
import { ErrorBox } from '@/components/ui';

type LoginResp = {
  token: string;
  user: { id: string; role: string; fullName: string; forceChangePassword: boolean };
};

export default function DriverLoginPage() {
  const router = useRouter();
  const [plate, setPlate] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<LoginResp>('/auth/login-driver', {
        method: 'POST',
        body: { plate: plate.trim(), password },
        auth: false,
      });
      auth.set(r.token);
      router.push(r.user.forceChangePassword ? '/driver/security' : '/driver');
    } catch (e) {
      setError(isApiError(e) ? e.message : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="panel-strong w-full max-w-sm p-7">
        <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">ParkSphere</div>
        <h1 className="font-display text-2xl mt-1">Driver Portal</h1>
        <p className="text-text-muted text-sm mt-2">
          Sign in with your vehicle plate and the password sent to you via WhatsApp.
        </p>

        <label className="block mt-5 text-xs text-text-secondary">Vehicle plate (username)</label>
        <input
          autoFocus
          required
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="e.g. WXY1234"
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm font-mono"
        />

        <label className="block mt-4 text-xs text-text-secondary">Password</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Temp password or your chosen password"
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
        />

        {error && <ErrorBox message={error} />}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet py-3 text-sm font-medium text-black/90 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="text-xs text-text-muted mt-4 text-center">
          Forgot your password? Visit reception — we can reset it on the spot.
        </div>
      </form>
    </main>
  );
}
