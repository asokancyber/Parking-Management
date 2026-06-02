'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, PageHeader } from '@/components/ui';

type Me = {
  driver: { forceChangePassword: boolean } | null;
};

const POLICY = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p), label: 'Lowercase letter' },
  { test: (p: string) => /\d/.test(p), label: 'Digit' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Special character (!@#$ etc.)' },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    api<Me>('/auth/me').then((m) => setForced(!!m.driver?.forceChangePassword)).catch(() => {});
  }, []);

  const rules = POLICY.map((r) => ({ ...r, ok: r.test(next) }));
  const allOk = rules.every((r) => r.ok);
  const match = next.length > 0 && next === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      router.replace('/driver');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        eyebrow="Security"
        title={forced ? 'Set your password' : 'Change your password'}
        description={
          forced
            ? 'You must set a personal password before you can use the portal. The temporary password you were given is one-time use only.'
            : 'Pick something strong — at least 8 characters with a mix of upper, lower, digit, and special character.'
        }
      />

      <form onSubmit={submit} className="panel-strong p-7 space-y-4">
        <div>
          <label className="block text-xs text-text-secondary">
            {forced ? 'Temporary password (from WhatsApp)' : 'Current password'}
          </label>
          <input
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-text-secondary">New password</label>
          <input
            type="password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-text-secondary">Confirm new password</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
          />
        </div>

        <ul className="space-y-1 text-xs">
          {rules.map((r) => (
            <li key={r.label} className={r.ok ? 'text-emerald-300' : 'text-text-muted'}>
              <span className="inline-block w-4">{r.ok ? '✓' : '·'}</span> {r.label}
            </li>
          ))}
          <li className={match ? 'text-emerald-300' : 'text-text-muted'}>
            <span className="inline-block w-4">{match ? '✓' : '·'}</span> Passwords match
          </li>
        </ul>

        {error && <ErrorBox message={error} />}

        <button
          type="submit"
          disabled={busy || !allOk || !match || !current}
          className="w-full rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet py-3 text-sm font-medium text-black/90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  );
}
