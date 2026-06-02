'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, StatTile, SkeletonTable, ErrorBox } from '@/components/ui';

type Me = {
  fullName: string;
  email: string;
  driver: {
    publicId: string;
    phone: string;
    company: string | null;
    forceChangePassword: boolean;
    lockedAt: string | null;
    lastLoginAt: string | null;
    passwordChangedAt: string | null;
    vehicles: Array<{ plate: string; type: string; active: boolean }>;
    subscriptions: Array<{ planName: string; priceCents: number; status: string; expiresAt: string }>;
    cards: Array<{ uid: string; label: string | null; status: string }>;
  } | null;
};

type Tap = {
  id: string;
  createdAt: string;
  result: string;
  reason: string | null;
  cardUid: string;
  gate: { code: string; name: string; direction: string };
};

export default function DriverDashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Me>('/auth/me'),
      api<{ items: Tap[] }>('/tap-events?take=10').catch(() => ({ items: [] as Tap[] })),
    ])
      .then(([m, t]) => {
        setMe(m);
        setTaps(t.items);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonTable rows={6} cols={3} />;
  if (!me || !me.driver) return <ErrorBox message={error ?? 'Profile not available'} />;

  const driver = me.driver;
  const sub = driver.subscriptions[0];
  const vehicle = driver.vehicles[0];
  const activeCard = driver.cards.find((c) => c.status === 'ACTIVE');
  const daysLeft = sub ? Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My account"
        title={`Welcome, ${me.fullName.split(' ')[0]}`}
        description={`Driver ID ${driver.publicId} · ${driver.phone}${driver.company ? ` · ${driver.company}` : ''}`}
      />

      {sub && sub.status === 'GRACE_PERIOD' && (
        <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/40 text-amber-200 p-4 text-sm">
          Your subscription expired on {new Date(sub.expiresAt).toLocaleDateString()}. You're in the grace period — please visit reception to renew.
        </div>
      )}
      {sub && sub.status === 'LAPSED' && (
        <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-500/40 text-rose-200 p-4 text-sm">
          Your subscription has lapsed. Gate access is denied. Please visit reception to reactivate.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Subscription"
          value={sub ? (sub.status === 'ACTIVE' ? 'Active' : sub.status.replaceAll('_', ' ').toLowerCase()) : '—'}
          sub={sub ? `${sub.planName} · RM ${(sub.priceCents / 100).toFixed(2)}` : 'No plan'}
          tone={sub?.status === 'ACTIVE' ? 'emerald' : sub?.status === 'GRACE_PERIOD' ? 'amber' : 'rose'}
        />
        <StatTile
          label="Days left"
          value={sub ? (daysLeft > 0 ? `${daysLeft}d` : `−${Math.abs(daysLeft)}d`) : '—'}
          sub={sub ? `expires ${new Date(sub.expiresAt).toLocaleDateString()}` : ''}
          tone={daysLeft > 7 ? 'cyan' : daysLeft > 0 ? 'amber' : 'rose'}
        />
        <StatTile label="Active card" value={activeCard?.uid ?? '—'} sub={activeCard?.label ?? 'No card issued'} />
        <StatTile label="Vehicle" value={vehicle?.plate ?? '—'} sub={vehicle?.type ?? '—'} />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel-strong p-6">
          <h2 className="font-display text-lg">My cards</h2>
          <div className="mt-3 space-y-2">
            {driver.cards.length === 0 ? (
              <div className="text-sm text-text-muted py-4 text-center">No cards yet. Visit reception to be issued one.</div>
            ) : driver.cards.map((c) => (
              <div key={c.uid} className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3 flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm">{c.uid}</div>
                  {c.label && <div className="text-[11px] text-text-muted">{c.label}</div>}
                </div>
                <span className={cn('pill', c.status === 'ACTIVE' ? 'pill-online' : c.status === 'LOST' ? 'pill-warn' : 'pill-offline')}>
                  {c.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-strong p-6">
          <h2 className="font-display text-lg">Recent gate activity</h2>
          <div className="mt-3 divide-y divide-bg-ring/50">
            {taps.length === 0 ? (
              <div className="text-sm text-text-muted py-4 text-center">No tap history yet.</div>
            ) : taps.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded text-[10px] font-bold ring-1',
                    t.result === 'GRANTED'
                      ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
                  )}
                >
                  {t.result === 'GRANTED' ? '✓' : '✕'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{t.gate.name} <span className="text-text-muted text-xs">· {t.gate.direction}</span></div>
                  {t.reason && t.result !== 'GRANTED' && (
                    <div className="text-[11px] text-text-muted">{t.reason}</div>
                  )}
                </div>
                <div className="text-xs text-text-muted font-mono">
                  {new Date(t.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="panel p-5 text-sm text-text-secondary flex items-center justify-between">
        <div>
          <div className="font-display text-text-primary">Security</div>
          <div className="text-xs mt-1">
            Last login: {driver.lastLoginAt ? new Date(driver.lastLoginAt).toLocaleString() : '—'}
            {driver.passwordChangedAt && (
              <> · Password changed {new Date(driver.passwordChangedAt).toLocaleDateString()}</>
            )}
          </div>
        </div>
        <Link
          href="/driver/security"
          className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2 text-xs hover:bg-bg-panel"
        >
          Change password →
        </Link>
      </div>
    </div>
  );
}
