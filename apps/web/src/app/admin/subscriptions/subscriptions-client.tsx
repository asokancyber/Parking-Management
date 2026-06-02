'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, StatTile, SkeletonTable, EmptyState, ErrorBox, Paginator } from '@/components/ui';

type Sub = {
  id: string;
  planName: string;
  priceCents: number;
  status: string;
  startsAt: string;
  expiresAt: string;
  lastRenewedAt?: string | null;
  lastPaymentRef?: string | null;
  driver: { id: string; publicId: string; fullName: string; phone: string };
};

type ListResp = { items: Sub[]; total: number; skip: number; take: number };
type Stats = { active: number; expired: number; expiringSoon: number; pending: number; blacklisted: number };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'expiring', label: 'Expiring 7d' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'GRACE_PERIOD', label: 'Grace' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'LAPSED', label: 'Lapsed' },
  { key: 'SUSPENDED', label: 'Suspended' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

export default function SubscriptionsClient() {
  const [data, setData] = useState<ListResp | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRenewOpen, setBulkRenewOpen] = useState(false);
  const take = 25;

  async function refresh() {
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('skip', String(skip));
      query.set('take', String(take));
      if (search) query.set('search', search);
      if (filter === 'expiring') query.set('expiringInDays', '7');
      else if (filter !== 'all') query.set('status', filter);

      const [list, s] = await Promise.all([
        api<ListResp>(`/subscriptions?${query.toString()}`),
        api<Stats>('/subscriptions/stats'),
      ]);
      setData(list);
      setStats(s);
      // Drop any selections that aren't in the current page anymore.
      setSelected((cur) => {
        const visible = new Set(list.items.map((x) => x.id));
        const next = new Set<string>();
        cur.forEach((id) => { if (visible.has(id)) next.add(id); });
        return next;
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSkip(0);
      void refresh();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function renew(s: Sub) {
    const paymentRef = window.prompt(
      `Renew ${s.driver.fullName}? Enter payment ref (cash receipt #, bank-in ref, or leave blank):`,
      '',
    );
    if (paymentRef === null) return;
    setBusyId(s.id);
    try {
      await api(`/subscriptions/${s.id}/renew`, { method: 'POST', body: { paymentRef: paymentRef || undefined } });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function extend(s: Sub) {
    const daysStr = window.prompt('Extend by how many days?', '30');
    if (!daysStr) return;
    const days = Number(daysStr);
    if (!Number.isFinite(days) || days < 1) return;
    setBusyId(s.id);
    try {
      await api(`/subscriptions/${s.id}/extend`, { method: 'POST', body: { days } });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(s: Sub) {
    if (!window.confirm(`Cancel ${s.driver.fullName}'s subscription?`)) return;
    setBusyId(s.id);
    try {
      await api(`/subscriptions/${s.id}/cancel`, { method: 'POST' });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const allVisibleSelected = useMemo(
    () => data && data.items.length > 0 && data.items.every((i) => selected.has(i.id)),
    [data, selected],
  );

  function toggleAll() {
    if (!data) return;
    setSelected((cur) => {
      const next = new Set(cur);
      const allSelected = data.items.every((i) => next.has(i.id));
      if (allSelected) data.items.forEach((i) => next.delete(i.id));
      else data.items.forEach((i) => next.add(i.id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Subscriptions"
        description="Renew, extend, cancel. Bulk-renew a fleet's drivers in one click."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Active" value={stats?.active ?? '—'} tone="emerald" />
        <StatTile label="Expiring 7d" value={stats?.expiringSoon ?? '—'} tone="amber" />
        <StatTile label="Expired" value={stats?.expired ?? '—'} tone="rose" />
        <StatTile label="Pending" value={stats?.pending ?? '—'} tone="cyan" />
        <StatTile label="Blacklisted" value={stats?.blacklisted ?? '—'} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-bg-elevated ring-1 ring-bg-ring p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs',
                filter === f.key
                  ? 'bg-bg-panel text-text-primary ring-1 ring-cyan-500/30'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search driver, plan…"
          className="flex-1 min-w-[200px] rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-3 py-2 text-sm"
        />
      </div>

      {/* Selection toolbar — appears when at least one row is selected */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between rounded-lg bg-accent-cyan/10 ring-1 ring-accent-cyan/40 px-4 py-3 text-sm"
          >
            <div>
              <span className="font-mono">{selected.size}</span> selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className="rounded-md bg-bg-elevated ring-1 ring-bg-ring px-3 py-1.5 text-xs"
              >
                Clear
              </button>
              <button
                onClick={() => setBulkRenewOpen(true)}
                className="rounded-md bg-gradient-to-r from-accent-cyan to-accent-violet px-4 py-1.5 text-xs font-medium text-black/90"
              >
                Renew {selected.size} selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ErrorBox message={error} />

      {loading && !data ? (
        <SkeletonTable rows={6} cols={6} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No subscriptions match" />
      ) : (
        <>
          <div className="panel-strong overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={!!allVisibleSelected}
                      onChange={toggleAll}
                      className="accent-cyan-400"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Driver</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Price</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Expires</th>
                  <th className="text-right px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-ring/50">
                {data.items.map((s) => {
                  const days = Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                  return (
                    <tr key={s.id} className={cn('hover:bg-bg-elevated/40', selected.has(s.id) && 'bg-accent-cyan/5')}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => toggleOne(s.id)}
                          className="accent-cyan-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/drivers/${s.driver.id}`} className="hover:underline">
                          <div className="text-sm">{s.driver.fullName}</div>
                          <div className="text-[11px] text-text-muted font-mono">{s.driver.publicId}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">{s.planName}</td>
                      <td className="px-4 py-3 font-mono text-sm">RM {(s.priceCents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} days={days} /></td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(s.expiresAt).toLocaleDateString()}
                        <div className="text-text-muted">{days > 0 ? `${days}d left` : `${Math.abs(days)}d overdue`}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button disabled={busyId === s.id} onClick={() => renew(s)} className="rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25 px-2.5 py-1 text-xs disabled:opacity-50">Renew</button>
                          <button disabled={busyId === s.id} onClick={() => extend(s)} className="rounded-md bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/40 px-2.5 py-1 text-xs disabled:opacity-50">Extend</button>
                          {s.status === 'ACTIVE' && (
                            <button disabled={busyId === s.id} onClick={() => cancel(s)} className="rounded-md bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30 px-2.5 py-1 text-xs disabled:opacity-50">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginator total={data.total} skip={data.skip} take={data.take} onChange={setSkip} />
        </>
      )}

      <AnimatePresence>
        {bulkRenewOpen && data && (
          <BulkRenewModal
            subs={data.items.filter((s) => selected.has(s.id))}
            onClose={() => setBulkRenewOpen(false)}
            onDone={async () => {
              setBulkRenewOpen(false);
              setSelected(new Set());
              await refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status, days }: { status: string; days: number }) {
  const tone =
    status === 'ACTIVE' && days > 7 ? 'pill-online'
    : status === 'ACTIVE' ? 'pill-warn'
    : status === 'GRACE_PERIOD' ? 'pill-warn'
    : status === 'LAPSED' ? 'pill-offline'
    : status === 'EXPIRED' ? 'pill-offline'
    : status === 'SUSPENDED' ? 'pill-offline'
    : 'pill-info';
  return <span className={cn('pill', tone)}>{status.replaceAll('_', ' ').toLowerCase()}</span>;
}

function BulkRenewModal({
  subs,
  onClose,
  onDone,
}: {
  subs: Sub[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [paymentRef, setPaymentRef] = useState('');
  const [days, setDays] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ renewed: number; failed: Array<{ id: string; error: string }> } | null>(null);
  const totalMyr = useMemo(() => subs.reduce((s, x) => s + x.priceCents, 0) / 100, [subs]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ renewed: number; failed: Array<{ id: string; error: string }> }>('/subscriptions/bulk-renew', {
        method: 'POST',
        body: {
          ids: subs.map((s) => s.id),
          paymentRef: paymentRef || undefined,
          days: days === '' ? undefined : days,
        },
      });
      setResult(r);
      if (r.failed.length === 0) await onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="panel-strong w-full max-w-md p-7"
      >
        <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">Bulk renew</div>
        <h2 className="font-display text-2xl mt-1">{subs.length} subscriptions</h2>
        <p className="text-text-muted text-sm mt-2">
          Total: <span className="font-mono text-text-primary">RM {totalMyr.toFixed(2)}</span> — each driver's term continues from current expiry (or today if already lapsed).
        </p>

        <label className="block mt-5 text-xs text-text-secondary">Payment reference (optional)</label>
        <input
          value={paymentRef}
          onChange={(e) => setPaymentRef(e.target.value)}
          placeholder="e.g. INV-2026-001 or bank-in 12:30"
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
        />

        <label className="block mt-4 text-xs text-text-secondary">Override duration (days, optional)</label>
        <input
          type="number" min={1} max={3650}
          value={days}
          onChange={(e) => setDays(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Leave blank to use each sub's original duration"
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
        />

        <ErrorBox message={error} />

        {result && (
          <div className={cn(
            'mt-4 rounded-lg p-3 text-sm ring-1',
            result.failed.length === 0
              ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200'
              : 'bg-amber-500/10 ring-amber-500/30 text-amber-200',
          )}>
            Renewed: <strong>{result.renewed}</strong>{' '}
            {result.failed.length > 0 && <>· Failed: <strong>{result.failed.length}</strong></>}
            {result.failed.length > 0 && (
              <ul className="mt-2 text-xs space-y-1">
                {result.failed.slice(0, 5).map((f) => (
                  <li key={f.id} className="font-mono">{f.id.slice(-8)}: {f.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2.5 text-sm">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2.5 text-sm font-medium text-black/90 disabled:opacity-60"
            >
              {busy ? 'Renewing…' : `Renew ${subs.length}`}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
