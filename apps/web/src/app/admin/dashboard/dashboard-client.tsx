'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { api, errorMessage } from '@/lib/api';
import { getSocket } from '@/lib/ws';
import { cn } from '@/lib/cn';
import { StatTile, PageHeader, SkeletonTable, ErrorBox } from '@/components/ui';

type SubStats = { active: number; expired: number; expiringSoon: number; pending: number; blacklisted: number };
type CardStats = { total: number; active: number; inStock: number; lost: number; blacklisted: number };
type TapSummary = { since: string; granted: number; denied: number; byResult: Record<string, number> };

type Gate = {
  id: string;
  code: string;
  name: string;
  status: string;
  direction: string;
  occupancy: number;
  capacity: number;
};

type Tap = {
  id: string;
  at: string;
  gateId: string;
  gateCode: string;
  cardUid: string;
  result: string;
  reason: string | null;
  driverPublicId: string | null;
  plate: string | null;
  granted: boolean;
};

export default function DashboardClient() {
  const [subStats, setSubStats] = useState<SubStats | null>(null);
  const [cardStats, setCardStats] = useState<CardStats | null>(null);
  const [tapSummary, setTapSummary] = useState<TapSummary | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    try {
      // Fetch initial stats + the most recent 20 taps so the activity feed
      // is populated as soon as the dashboard opens (not just empty until
      // the next live tap arrives over WebSocket).
      const [s, c, ts, g, recent] = await Promise.all([
        api<SubStats>('/subscriptions/stats'),
        api<CardStats>('/cards/stats'),
        api<TapSummary>('/tap-events/summary'),
        api<Gate[]>('/gates'),
        api<{ items: Array<{
          id: string;
          createdAt: string;
          gateId: string;
          gate: { code: string };
          cardUid: string;
          result: string;
          reason: string | null;
          driver: { publicId: string } | null;
          vehicle: { plate: string } | null;
        }> }>('/tap-events?take=20').catch(() => ({ items: [] })),
      ]);
      setSubStats(s);
      setCardStats(c);
      setTapSummary(ts);
      setGates(g);
      // Reshape historical taps to the same Tap shape the WS broadcasts use.
      setTaps(
        recent.items.map((t) => ({
          id: t.id,
          at: t.createdAt,
          gateId: t.gateId,
          gateCode: t.gate.code,
          cardUid: t.cardUid,
          result: t.result,
          reason: t.reason,
          driverPublicId: t.driver?.publicId ?? null,
          plate: t.vehicle?.plate ?? null,
          granted: t.result === 'GRANTED',
        })),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();

    const socket = getSocket();
    const join = () => socket.emit('admin:join');
    const onTap = (t: Tap) => {
      setTaps((prev) => [t, ...prev].slice(0, 50));
      if (t.granted) {
        // Refresh occupancy quickly.
        api<Gate[]>('/gates').then(setGates).catch(() => {});
      }
      // Update local summary optimistically.
      setTapSummary((cur) =>
        cur
          ? {
              ...cur,
              granted: cur.granted + (t.granted ? 1 : 0),
              denied: cur.denied + (t.granted ? 0 : 1),
              byResult: { ...cur.byResult, [t.result]: (cur.byResult[t.result] ?? 0) + 1 },
            }
          : cur,
      );
    };
    socket.on('connect', join);
    socket.on('tap', onTap);
    if (socket.connected) join();
    return () => {
      socket.off('connect', join);
      socket.off('tap', onTap);
    };
  }, []);

  const totalOccupied = gates.reduce((acc, g) => acc + g.occupancy, 0);
  const totalCapacity = gates.reduce((acc, g) => acc + g.capacity, 0);
  const occPct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  const denialBreakdown = useMemo(() => {
    if (!tapSummary) return [];
    return Object.entries(tapSummary.byResult)
      .filter(([k]) => k !== 'GRANTED')
      .sort((a, b) => b[1] - a[1]);
  }, [tapSummary]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Live Operations"
        title="Command Center"
        action={
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft" />
            Realtime
          </div>
        }
      />

      <ErrorBox message={error} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Occupancy" value={`${occPct}%`} sub={`${totalOccupied}/${totalCapacity}`} tone="cyan" />
        <StatTile label="Granted 24h" value={tapSummary?.granted ?? '—'} tone="emerald" />
        <StatTile label="Denied 24h" value={tapSummary?.denied ?? '—'} tone="rose" />
        <StatTile label="Expiring 7d" value={subStats?.expiringSoon ?? '—'} sub={`${subStats?.active ?? 0} active subs`} tone="amber" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Cards Active" value={cardStats?.active ?? '—'} sub={`${cardStats?.total ?? 0} total`} />
        <StatTile label="Cards In Stock" value={cardStats?.inStock ?? '—'} />
        <StatTile label="Lost / Blacklisted" value={(cardStats?.lost ?? 0) + (cardStats?.blacklisted ?? 0)} tone="rose" />
        <StatTile label="Expired Subs" value={subStats?.expired ?? '—'} />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Live tap feed */}
        <div className="panel-strong p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-lg">Live Tap Activity</h2>
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <span><span className="text-emerald-300 tabular">{taps.filter((t) => t.granted).length}</span> granted</span>
              <span><span className="text-rose-300 tabular">{taps.filter((t) => !t.granted).length}</span> denied</span>
              <Link href="/admin/tap-history" className="text-accent-cyan hover:underline">Full history →</Link>
            </div>
          </div>
          {loading ? (
            <SkeletonTable rows={8} cols={3} />
          ) : taps.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-muted">
              No taps yet. Open <Link href="/admin/gates" className="text-accent-cyan">Gates</Link> and use the simulator.
            </div>
          ) : (
            <div className="mt-3 divide-y divide-bg-ring/50">
              <AnimatePresence initial={false}>
                {taps.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-[28px_1fr_auto] items-start gap-3 py-3"
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid h-6 w-6 place-items-center rounded-md text-xs font-bold ring-1',
                        t.granted
                          ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
                      )}
                    >
                      {t.granted ? '✓' : '✕'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs">{t.cardUid}</span>
                        {t.driverPublicId && (
                          <>
                            <span className="text-text-muted">→</span>
                            <span className="text-text-primary">{t.driverPublicId}</span>
                          </>
                        )}
                        {t.plate && <span className="text-text-secondary font-mono text-xs">· {t.plate}</span>}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {t.gateCode}
                        {!t.granted && t.reason ? ` · ${t.reason}` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-text-muted font-mono whitespace-nowrap">
                      {new Date(t.at).toLocaleTimeString([], { hour12: false })}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right column: gates + denial breakdown */}
        <div className="space-y-6">
          <div className="panel-strong p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Gates</h2>
              <Link href="/admin/gates" className="text-xs text-accent-cyan hover:underline">Manage →</Link>
            </div>
            <div className="mt-3 space-y-3">
              {gates.length === 0 && <div className="text-sm text-text-muted py-4 text-center">No gates configured.</div>}
              {gates.map((g) => {
                const pct = g.capacity > 0 ? Math.round((g.occupancy / g.capacity) * 100) : 0;
                return (
                  <div key={g.id} className="rounded-xl bg-bg-elevated/60 ring-1 ring-bg-ring p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm">{g.name}</div>
                        <div className="text-[10px] text-text-muted font-mono">{g.code} · {g.direction}</div>
                      </div>
                      <span className={cn('pill', g.status === 'ONLINE' ? 'pill-online' : 'pill-offline')}>
                        {g.status}
                      </span>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-bg-base">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-violet"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-text-secondary flex justify-between">
                      <span>{g.occupancy}/{g.capacity}</span>
                      <Link href={`/gate/${g.code}/monitor`} target="_blank" className="text-accent-cyan hover:underline">
                        Monitor →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel-strong p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Denials (24h)</h2>
            </div>
            {denialBreakdown.length === 0 ? (
              <div className="mt-3 text-sm text-text-muted py-4 text-center">No denials. Clean operations.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {denialBreakdown.map(([result, count]) => (
                  <div key={result} className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">{result.replace('DENIED_', '').replaceAll('_', ' ').toLowerCase()}</span>
                    <span className="font-mono text-rose-300 tabular">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
