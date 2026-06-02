'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, StatTile, SkeletonTable, EmptyState, ErrorBox, Paginator } from '@/components/ui';

type Tap = {
  id: string;
  cardUid: string;
  result: string;
  reason: string | null;
  createdAt: string;
  gate: { code: string; name: string; direction: string };
  driver: { publicId: string; fullName: string } | null;
  vehicle: { plate: string; type: string } | null;
  card: { uid: string; label: string | null } | null;
};

type ListResp = { items: Tap[]; total: number; skip: number; take: number };
type Summary = { since: string; granted: number; denied: number; byResult: Record<string, number> };
type Gate = { id: string; code: string; name: string };

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'granted', label: 'Granted only' },
  { key: 'denied', label: 'Denied only' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];

export default function TapHistoryClient() {
  const [data, setData] = useState<ListResp | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [gateId, setGateId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 50;

  async function refresh() {
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set('skip', String(skip));
      q.set('take', String(take));
      if (status === 'granted') q.set('granted', 'true');
      if (status === 'denied') q.set('granted', 'false');
      if (gateId) q.set('gateId', gateId);
      if (search) q.set('search', search);

      const [list, s, g] = await Promise.all([
        api<ListResp>(`/tap-events?${q.toString()}`),
        api<Summary>('/tap-events/summary'),
        gates.length === 0 ? api<Gate[]>('/gates') : Promise.resolve(gates),
      ]);
      setData(list);
      setSummary(s);
      if (gates.length === 0) setGates(g as Gate[]);
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
  }, [skip, status, gateId]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSkip(0);
      void refresh();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Tap History"
        description="Every card tap recorded by every gate — including denials, with reason and full context."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="Granted (24h)" value={summary?.granted ?? '—'} tone="emerald" />
        <StatTile label="Denied (24h)" value={summary?.denied ?? '—'} tone="rose" />
        <StatTile
          label="Most common denial"
          value={topDenial(summary?.byResult) ?? '—'}
          sub={
            summary
              ? `${Object.entries(summary.byResult)
                  .filter(([k]) => k !== 'GRANTED')
                  .reduce((a, [, n]) => a + n, 0)} total`
              : ''
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-bg-elevated ring-1 ring-bg-ring p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs',
                status === f.key
                  ? 'bg-bg-panel text-text-primary ring-1 ring-cyan-500/30'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={gateId}
          onChange={(e) => setGateId(e.target.value)}
          className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-3 py-2 text-sm"
        >
          <option value="">All gates</option>
          {gates.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search UID, plate, driver…"
          className="flex-1 min-w-[200px] rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-3 py-2 text-sm"
        />
      </div>

      <ErrorBox message={error} />

      {loading && !data ? (
        <SkeletonTable rows={10} cols={5} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No taps match" body={search ? 'Try a wider search.' : 'Wait for a tap, or simulate one from the Gates page.'} />
      ) : (
        <>
          <div className="panel-strong overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">Result</th>
                  <th className="text-left px-4 py-3 font-medium">Card</th>
                  <th className="text-left px-4 py-3 font-medium">Driver / Vehicle</th>
                  <th className="text-left px-4 py-3 font-medium">Gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-ring/50">
                {data.items.map((t) => {
                  const granted = t.result === 'GRANTED';
                  return (
                    <tr key={t.id} className="hover:bg-bg-elevated/40">
                      <td className="px-4 py-3 text-xs font-mono text-text-secondary whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'grid h-5 w-5 place-items-center rounded text-[10px] font-bold ring-1',
                              granted
                                ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
                            )}
                          >
                            {granted ? '✓' : '✕'}
                          </span>
                          <div>
                            <div className="text-xs font-mono">{t.result}</div>
                            {t.reason && !granted && (
                              <div className="text-[10px] text-text-muted">{t.reason}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {t.cardUid}
                        {t.card?.label && (
                          <div className="text-[10px] text-text-muted">{t.card.label}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {t.driver ? (
                          <>
                            <div>{t.driver.fullName}</div>
                            <div className="font-mono text-text-muted text-[11px]">
                              {t.driver.publicId}
                              {t.vehicle && ` · ${t.vehicle.plate}`}
                            </div>
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Link href="/admin/gates" className="hover:underline">
                          {t.gate.name}
                        </Link>
                        <div className="text-text-muted">{t.gate.direction}</div>
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
    </div>
  );
}

function topDenial(byResult?: Record<string, number>): string | null {
  if (!byResult) return null;
  const denials = Object.entries(byResult).filter(([k]) => k !== 'GRANTED');
  if (denials.length === 0) return null;
  denials.sort((a, b) => b[1] - a[1]);
  return denials[0][0].replace('DENIED_', '').replaceAll('_', ' ').toLowerCase();
}
