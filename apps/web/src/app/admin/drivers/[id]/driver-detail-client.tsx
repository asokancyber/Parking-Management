'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorBox, PageHeader, SkeletonTable, ConfirmButton } from '@/components/ui';

type Driver = {
  id: string;
  publicId: string;
  fullName: string;
  phone: string;
  company: string | null;
  createdAt: string;
  forceChangePassword: boolean;
  lockedAt: string | null;
  lockedReason: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  user: { id: string; email: string; role: string; fullName: string };
  vehicles: Array<{ id: string; plate: string; type: string; active: boolean; createdAt: string }>;
  subscriptions: Array<{ id: string; planName: string; priceCents: number; status: string; startsAt: string; expiresAt: string }>;
  cards: Array<{ id: string; uid: string; label: string | null; status: string; issuedAt: string | null }>;
  cardAssignments: Array<{ id: string; fromAt: string; toAt: string | null; reason: string; card: { uid: string; label: string | null } }>;
  recentTaps: Array<{ id: string; cardUid: string; result: string; reason: string | null; createdAt: string; gate: { code: string; name: string; direction: string } }>;
};

type ResetResult = { tempPassword: string; portalUrl: string };

export default function DriverDetailClient({ id }: { id: string }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showExtend, setShowExtend] = useState<{ id: string } | null>(null);
  const [showNewSub, setShowNewSub] = useState(false);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);

  async function refresh() {
    setError(null);
    try {
      const d = await api<Driver>(`/drivers/${id}`);
      setDriver(d);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function suspend() {
    setBusy(true);
    try {
      const reason = window.prompt('Reason for suspension?') ?? undefined;
      await api(`/drivers/${id}/suspend`, { method: 'POST', body: { reason } });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function reactivate() {
    setBusy(true);
    try {
      await api(`/drivers/${id}/reactivate`, { method: 'POST' });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!window.confirm(
      'Reset password? A fresh temp password will be generated, sent via WhatsApp, and shown to you ONCE on screen.',
    )) return;
    setBusy(true);
    try {
      const r = await api<ResetResult>(`/drivers/${id}/reset-password`, { method: 'POST', body: {} });
      setResetResult(r);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function lockOrUnlock(lock: boolean) {
    setBusy(true);
    try {
      if (lock) {
        const reason = window.prompt('Reason for locking the account?') ?? '';
        await api(`/drivers/${id}/lock`, { method: 'POST', body: { reason } });
      } else {
        await api(`/drivers/${id}/unlock`, { method: 'POST', body: {} });
      }
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function forceChange(force: boolean) {
    setBusy(true);
    try {
      await api(`/drivers/${id}/force-change`, { method: 'POST', body: { force } });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function openPrintCard() {
    window.open(`/admin/drivers/${id}/print/card`, '_blank');
  }
  function openPrintWelcome(temp?: string, portal?: string) {
    const q = new URLSearchParams();
    if (temp) q.set('temp', temp);
    if (portal) q.set('portal', portal);
    window.open(`/admin/drivers/${id}/print/welcome?${q.toString()}`, '_blank');
  }

  if (loading) return <SkeletonTable rows={10} />;
  if (!driver) return <ErrorBox message={error ?? 'Driver not found'} />;

  const activeSub = driver.subscriptions[0];
  const isSuspended = activeSub?.status === 'SUSPENDED';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/admin/drivers" className="hover:text-text-primary">
            ← Drivers
          </Link>
        }
        title={driver.fullName}
        description={`${driver.publicId} · joined ${new Date(driver.createdAt).toLocaleDateString()}`}
        action={
          <div className="flex gap-2">
            {isSuspended ? (
              <button
                onClick={reactivate}
                disabled={busy}
                className="rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 px-4 py-2 text-sm"
              >
                Reactivate
              </button>
            ) : (
              <ConfirmButton
                prompt={`Suspend ${driver.fullName}? All taps will be denied until reactivated.`}
                onConfirm={suspend}
                disabled={busy}
                className="rounded-lg bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30 px-4 py-2 text-sm"
              >
                Suspend
              </ConfirmButton>
            )}
          </div>
        }
      />

      <ErrorBox message={error} />

      {resetResult && (
        <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-xs text-amber-300 tracking-[0.2em] uppercase">⚠ New temporary password — visible once</div>
              <div className="mt-3 grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
                <div className="text-text-secondary">Username (plate)</div>
                <div className="font-mono text-text-primary">{driver.vehicles[0]?.plate ?? '—'}</div>
                <div className="text-text-secondary">Temp password</div>
                <div className="font-mono text-text-primary text-base">{resetResult.tempPassword}</div>
                <div className="text-text-secondary">Portal</div>
                <div className="font-mono text-text-primary break-all">{resetResult.portalUrl}</div>
              </div>
              <p className="text-xs text-text-muted mt-3">
                WhatsApp delivery queued. The driver will be required to change this on first login.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => openPrintWelcome(resetResult.tempPassword, resetResult.portalUrl)}
                className="rounded-md bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/40 px-3 py-2 text-xs"
              >
                🖨 Print slip
              </button>
              <button
                onClick={() => setResetResult(null)}
                className="rounded-md bg-bg-elevated ring-1 ring-bg-ring px-3 py-2 text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <InfoCard label="Email" value={driver.user.email} />
        <InfoCard label="Phone" value={driver.phone} mono />
        <InfoCard label="Company" value={driver.company ?? '—'} />
      </div>

      {/* Security panel — admin password management */}
      <section className="panel-strong p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-display text-lg">Security</h2>
            <p className="text-text-muted text-xs mt-1">
              Passwords are hashed (argon2) and never visible. Resetting generates a fresh temp password sent via WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openPrintCard} className="rounded-md bg-accent-violet/15 text-accent-violet ring-1 ring-accent-violet/40 px-3 py-1.5 text-xs">🖨 Print RFID card</button>
            <button onClick={() => openPrintWelcome()} className="rounded-md bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/40 px-3 py-1.5 text-xs">🖨 Print welcome slip</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3">
            <div className="text-text-muted text-[10px] uppercase tracking-[0.2em]">Account</div>
            <div className="mt-1">
              {driver.lockedAt ? (
                <span className="pill pill-offline">locked</span>
              ) : (
                <span className="pill pill-online">unlocked</span>
              )}
            </div>
            {driver.lockedReason && <div className="text-[10px] text-text-muted mt-1">{driver.lockedReason}</div>}
          </div>
          <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3">
            <div className="text-text-muted text-[10px] uppercase tracking-[0.2em]">Force change</div>
            <div className="mt-1">
              {driver.forceChangePassword ? (
                <span className="pill pill-warn">required</span>
              ) : (
                <span className="pill pill-online">not required</span>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3">
            <div className="text-text-muted text-[10px] uppercase tracking-[0.2em]">Last login</div>
            <div className="mt-1 font-mono text-text-primary text-xs">
              {driver.lastLoginAt ? new Date(driver.lastLoginAt).toLocaleString() : 'never'}
            </div>
          </div>
          <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3">
            <div className="text-text-muted text-[10px] uppercase tracking-[0.2em]">Password changed</div>
            <div className="mt-1 font-mono text-text-primary text-xs">
              {driver.passwordChangedAt ? new Date(driver.passwordChangedAt).toLocaleString() : 'never'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            disabled={busy}
            onClick={resetPassword}
            className="rounded-md bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/20 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Reset password
          </button>
          <button
            disabled={busy}
            onClick={() => forceChange(!driver.forceChangePassword)}
            className="rounded-md bg-bg-elevated ring-1 ring-bg-ring hover:bg-bg-panel px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {driver.forceChangePassword ? 'Clear force-change' : 'Force password change'}
          </button>
          {driver.lockedAt ? (
            <button
              disabled={busy}
              onClick={() => lockOrUnlock(false)}
              className="rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Unlock account
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => lockOrUnlock(true)}
              className="rounded-md bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/20 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Lock account
            </button>
          )}
        </div>
      </section>

      {/* Vehicles */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">Vehicles</h2>
        <div className="panel-strong overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Plate</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-ring/50">
              {driver.vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 font-mono">{v.plate}</td>
                  <td className="px-4 py-2">{v.type}</td>
                  <td className="px-4 py-2">
                    <span className={cn('pill', v.active ? 'pill-online' : 'pill-offline')}>
                      {v.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{new Date(v.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Subscriptions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Subscriptions</h2>
          <button
            onClick={() => setShowNewSub(true)}
            className="rounded-md bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/40 px-3 py-1.5 text-xs"
          >
            + New subscription
          </button>
        </div>
        <div className="panel-strong overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Plan</th>
                <th className="text-left px-4 py-2 font-medium">Price</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Starts</th>
                <th className="text-left px-4 py-2 font-medium">Expires</th>
                <th className="text-right px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-ring/50">
              {driver.subscriptions.map((s, i) => (
                <tr key={s.id} className={i === 0 ? 'bg-bg-elevated/30' : ''}>
                  <td className="px-4 py-2">{s.planName}</td>
                  <td className="px-4 py-2 font-mono">RM {(s.priceCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2"><span className={cn('pill', s.status === 'ACTIVE' ? 'pill-online' : s.status === 'EXPIRED' ? 'pill-offline' : 'pill-warn')}>{s.status.toLowerCase()}</span></td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{new Date(s.startsAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{new Date(s.expiresAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    {i === 0 && (
                      <button
                        onClick={() => setShowExtend({ id: s.id })}
                        className="text-xs text-accent-cyan hover:underline"
                      >
                        Extend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">Cards</h2>
        <div className="panel-strong overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">UID</th>
                <th className="text-left px-4 py-2 font-medium">Label</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-ring/50">
              {driver.cards.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-text-muted text-xs">
                    No cards. <Link href="/admin/cards" className="text-accent-cyan underline">Issue one</Link>.
                  </td>
                </tr>
              ) : driver.cards.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-mono">{c.uid}</td>
                  <td className="px-4 py-2 text-xs">{c.label ?? '—'}</td>
                  <td className="px-4 py-2"><span className={cn('pill', c.status === 'ACTIVE' ? 'pill-online' : 'pill-offline')}>{c.status.toLowerCase()}</span></td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent taps */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">Recent taps</h2>
        <div className="panel-strong overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Gate</th>
                <th className="text-left px-4 py-2 font-medium">Card</th>
                <th className="text-left px-4 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-ring/50">
              {driver.recentTaps.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-text-muted text-xs">No tap activity yet.</td>
                </tr>
              ) : driver.recentTaps.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-xs font-mono">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs">{t.gate.name} <span className="text-text-muted">· {t.gate.direction}</span></td>
                  <td className="px-4 py-2 font-mono text-xs">{t.cardUid}</td>
                  <td className="px-4 py-2">
                    <span className={cn('pill', t.result === 'GRANTED' ? 'pill-online' : 'pill-offline')}>
                      {t.result === 'GRANTED' ? 'granted' : (t.reason ?? t.result)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showExtend && <ExtendModal subId={showExtend.id} onClose={() => setShowExtend(null)} onDone={async () => { setShowExtend(null); await refresh(); }} />}
      {showNewSub && <NewSubModal driverId={driver.id} onClose={() => setShowNewSub(false)} onDone={async () => { setShowNewSub(false); await refresh(); }} />}
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className={cn('mt-1 text-sm', mono && 'font-mono')}>{value}</div>
    </div>
  );
}

function ExtendModal({ subId, onClose, onDone }: { subId: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/subscriptions/${subId}/extend`, { method: 'POST', body: { days } });
      await onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="panel-strong w-full max-w-sm p-7">
        <h2 className="font-display text-xl">Extend subscription</h2>
        <p className="text-text-muted text-sm mt-1">Add days from today (or from current expiry if still active).</p>
        <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-5 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2" />
        <ErrorBox message={error} />
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-4 py-2 text-sm font-medium text-black/90 disabled:opacity-60">{busy ? 'Extending…' : `Add ${days}d`}</button>
        </div>
      </form>
    </div>
  );
}

function NewSubModal({ driverId, onClose, onDone }: { driverId: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [planName, setPlanName] = useState('Staff Monthly');
  const [priceMyr, setPriceMyr] = useState(120);
  const [durationDays, setDurationDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/subscriptions', { method: 'POST', body: { driverId, planName, priceCents: Math.round(priceMyr * 100), durationDays } });
      await onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="panel-strong w-full max-w-md p-7">
        <h2 className="font-display text-xl">New subscription</h2>
        <p className="text-text-muted text-sm mt-1">Activates immediately and runs for the duration you set.</p>
        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs text-text-secondary">Plan name</label>
            <input value={planName} onChange={(e) => setPlanName(e.target.value)} required className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary">Price (RM)</label>
              <input type="number" min={0} step="0.01" value={priceMyr} onChange={(e) => setPriceMyr(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Duration (days)</label>
              <input type="number" min={1} max={3650} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <ErrorBox message={error} />
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-4 py-2 text-sm font-medium text-black/90 disabled:opacity-60">{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
