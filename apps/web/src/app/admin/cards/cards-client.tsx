'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

type Driver = {
  id: string;
  publicId: string;
  fullName: string;
};

type Card = {
  id: string;
  uid: string;
  label: string | null;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  driver: Driver | null;
  replaces: { id: string; uid: string } | null;
  replacedBy: { id: string; uid: string } | null;
  createdAt: string;
};

type Stats = {
  total: number;
  active: number;
  inStock: number;
  lost: number;
  blacklisted: number;
};

const STATUSES = ['ALL', 'ACTIVE', 'IN_STOCK', 'SUSPENDED', 'LOST', 'BLACKLISTED', 'RETIRED'] as const;
type Filter = (typeof STATUSES)[number];

// Status transitions surfaced as actions. Mirrors the server-side allow-list.
const ACTIONS: Record<string, Array<{ status: string; label: string; tone: 'neutral' | 'warn' | 'danger' }>> = {
  IN_STOCK:    [{ status: 'RETIRED', label: 'Retire', tone: 'neutral' }],
  ACTIVE:      [
    { status: 'SUSPENDED', label: 'Suspend', tone: 'warn' },
    { status: 'LOST', label: 'Report lost', tone: 'warn' },
    { status: 'BLACKLISTED', label: 'Blacklist', tone: 'danger' },
  ],
  SUSPENDED:   [
    { status: 'ACTIVE', label: 'Reactivate', tone: 'neutral' },
    { status: 'BLACKLISTED', label: 'Blacklist', tone: 'danger' },
  ],
  LOST:        [{ status: 'BLACKLISTED', label: 'Blacklist', tone: 'danger' }, { status: 'RETIRED', label: 'Retire', tone: 'neutral' }],
  BLACKLISTED: [{ status: 'RETIRED', label: 'Retire', tone: 'neutral' }],
  RETIRED:     [],
};

export default function CardsClient() {
  const [cards, setCards] = useState<Card[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIssue, setShowIssue] = useState(false);

  async function refresh() {
    try {
      // /drivers became paginated in Phase 1 — pull the first 100 for the
      // assign-to dropdown. If you have more than 100 drivers, this dropdown
      // should turn into a typeahead; out of scope for now.
      const [c, s, d] = await Promise.all([
        api<Card[]>('/cards'),
        api<Stats>('/cards/stats'),
        api<{ items: Driver[] }>('/drivers?take=100'),
      ]);
      setCards(c);
      setStats(s);
      setDrivers(d.items);
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Failed to load');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (filter !== 'ALL' && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.uid.toLowerCase().includes(q) ||
        (c.label ?? '').toLowerCase().includes(q) ||
        (c.driver?.publicId ?? '').toLowerCase().includes(q) ||
        (c.driver?.fullName ?? '').toLowerCase().includes(q)
      );
    });
  }, [cards, filter, search]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/cards/${id}/status`, { method: 'PUT', body: { status } });
      await refresh();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function replace(id: string) {
    const newUid = window.prompt('Enter the UID of the replacement card:');
    if (!newUid) return;
    setBusyId(id);
    setError(null);
    try {
      await api(`/cards/${id}/replace`, { method: 'POST', body: { newUid } });
      await refresh();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Replace failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">Access cards</div>
          <h1 className="font-display text-4xl mt-1">RFID / NFC Cards</h1>
        </div>
        <button
          onClick={() => setShowIssue(true)}
          className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-4 py-2.5 text-sm font-medium text-black/90"
        >
          + Issue new card
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Total" value={stats?.total ?? '—'} />
        <StatTile label="Active" value={stats?.active ?? '—'} tone="cyan" />
        <StatTile label="In stock" value={stats?.inStock ?? '—'} />
        <StatTile label="Lost" value={stats?.lost ?? '—'} tone="amber" />
        <StatTile label="Blacklisted" value={stats?.blacklisted ?? '—'} tone="rose" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-bg-elevated ring-1 ring-bg-ring p-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs',
                filter === s
                  ? 'bg-bg-panel text-text-primary ring-1 ring-cyan-500/30'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {s === 'ALL' ? 'All' : s.replaceAll('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search UID, label, driver…"
          className="flex-1 min-w-[200px] rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-3 py-2 text-sm"
        />
      </div>

      {error && <div className="text-rose-300 text-sm">{error}</div>}

      <div className="panel-strong overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Card</th>
              <th className="text-left px-4 py-3 font-medium">Driver</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Issued</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-ring/50">
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-text-muted py-10">
                  No cards match.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr key={c.id} className="hover:bg-bg-elevated/40">
                <td className="px-4 py-3">
                  <div className="font-mono text-text-primary">{c.uid}</div>
                  <div className="text-xs text-text-muted">{c.label ?? '—'}</div>
                  {c.replaces && (
                    <div className="text-[10px] text-text-muted mt-0.5">
                      replaces <span className="font-mono">{c.replaces.uid}</span>
                    </div>
                  )}
                  {c.replacedBy && (
                    <div className="text-[10px] text-text-muted mt-0.5">
                      replaced by <span className="font-mono">{c.replacedBy.uid}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.driver ? (
                    <div>
                      <div className="font-mono text-text-primary text-xs">{c.driver.publicId}</div>
                      <div className="text-xs text-text-muted">{c.driver.fullName}</div>
                    </div>
                  ) : (
                    <span className="text-text-muted text-xs">unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {(ACTIONS[c.status] ?? []).map((a) => (
                      <button
                        key={a.status}
                        onClick={() => setStatus(c.id, a.status)}
                        disabled={busyId === c.id}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs ring-1 disabled:opacity-50',
                          a.tone === 'danger' && 'bg-rose-500/10 text-rose-300 ring-rose-500/30 hover:bg-rose-500/20',
                          a.tone === 'warn' && 'bg-amber-500/10 text-amber-300 ring-amber-500/30 hover:bg-amber-500/20',
                          a.tone === 'neutral' && 'bg-bg-elevated text-text-primary ring-bg-ring hover:bg-bg-panel',
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                    {c.driver && c.status !== 'RETIRED' && c.status !== 'BLACKLISTED' && (
                      <button
                        onClick={() => replace(c.id)}
                        disabled={busyId === c.id}
                        className="rounded-md bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30 hover:bg-cyan-500/20 px-2.5 py-1 text-xs disabled:opacity-50"
                      >
                        Replace
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showIssue && (
          <IssueModal
            drivers={drivers}
            onClose={() => setShowIssue(false)}
            onIssued={async () => {
              setShowIssue(false);
              await refresh();
            }}
            onError={setError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function IssueModal({
  drivers,
  onClose,
  onIssued,
  onError,
}: {
  drivers: Driver[];
  onClose: () => void;
  onIssued: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [uid, setUid] = useState('');
  const [label, setLabel] = useState('');
  const [driverId, setDriverId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/cards', {
        method: 'POST',
        body: {
          uid: uid.trim(),
          label: label.trim() || undefined,
          driverId: driverId || undefined,
        },
      });
      await onIssued();
    } catch (e) {
      onError((e as { message?: string }).message ?? 'Failed to issue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="panel-strong w-full max-w-md p-7"
      >
        <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">Issue card</div>
        <h2 className="font-display text-2xl mt-1">New RFID / NFC card</h2>
        <p className="text-text-muted text-sm mt-2">
          Tap the card on your reader, paste the UID it produced, optionally assign to a driver now.
        </p>

        <label className="block mt-5 text-xs text-text-secondary">Card UID</label>
        <input
          autoFocus
          required
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          placeholder="e.g. 04A21B3C"
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm font-mono"
        />

        <label className="block mt-4 text-xs text-text-secondary">Label (optional)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Driver Card #001"
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
        />

        <label className="block mt-4 text-xs text-text-secondary">Assign to driver (optional)</label>
        <select
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
        >
          <option value="">— leave in stock —</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.publicId} · {d.fullName}
            </option>
          ))}
        </select>

        <div className="mt-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2.5 text-sm font-medium text-black/90 disabled:opacity-60"
          >
            {busy ? 'Issuing…' : 'Issue card'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'cyan' | 'amber' | 'rose';
}) {
  return (
    <div className="panel p-4">
      <div className="text-text-secondary text-[10px] tracking-[0.2em] uppercase">{label}</div>
      <div
        className={cn(
          'font-display tabular text-3xl mt-1 leading-none',
          tone === 'cyan' && 'text-accent-cyan',
          tone === 'amber' && 'text-accent-amber',
          tone === 'rose' && 'text-accent-rose',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'ACTIVE'
      ? 'pill-online'
      : status === 'IN_STOCK'
        ? 'pill-info'
        : status === 'SUSPENDED' || status === 'LOST'
          ? 'pill-warn'
          : 'pill-offline';
  return <span className={cn('pill', tone)}>{status.replaceAll('_', ' ').toLowerCase()}</span>;
}
