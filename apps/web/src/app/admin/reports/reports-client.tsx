'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, auth, errorMessage } from '@/lib/api';
import { API_BASE_URL, API_PREFIX } from '@/lib/env';
import { cn } from '@/lib/cn';
import { PageHeader, StatTile, SkeletonTable, ErrorBox } from '@/components/ui';

type Summary = {
  revenue: { monthStart: string; monthEnd: string; count: number; totalCents: number; activeCents: number };
  daily: Array<{ date: string; granted: number; denied: number }>;
  expiring: Array<{
    id: string;
    planName: string;
    priceCents: number;
    expiresAt: string;
    driver: { id: string; publicId: string; fullName: string; phone: string };
  }>;
  denials: Array<{ result: string; count: number }>;
};

export default function ReportsClient() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>('/reports/summary')
      .then(setData)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  // All hooks must run on every render — keep useMemo above any early return.
  const maxDaily = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.daily.map((d) => d.granted + d.denied));
  }, [data]);

  if (loading) return (
    <div className="space-y-6">
      <PageHeader eyebrow="Compliance" title="Reports" />
      <SkeletonTable rows={6} cols={3} />
    </div>
  );

  if (error) return (
    <div className="space-y-6">
      <PageHeader eyebrow="Compliance" title="Reports" />
      <ErrorBox message={error} />
    </div>
  );

  const revenueMyr = (data?.revenue.totalCents ?? 0) / 100;
  const activeMyr = (data?.revenue.activeCents ?? 0) / 100;
  const monthLabel = data
    ? new Date(data.revenue.monthStart).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Compliance"
        title="Reports"
        description="Monthly revenue, tap trends, expiring subscriptions, denial breakdown. Export raw data as CSV from the buttons on the right."
      />

      {/* Revenue */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile
          label={`Revenue · ${monthLabel}`}
          value={`RM ${revenueMyr.toFixed(2)}`}
          sub={`${data?.revenue.count ?? 0} subscriptions started`}
          tone="emerald"
        />
        <StatTile
          label="Active value"
          value={`RM ${activeMyr.toFixed(2)}`}
          sub="from currently-active subs in this month"
          tone="cyan"
        />
        <StatTile
          label="Expiring in 14 days"
          value={data?.expiring.length ?? 0}
          sub="renewal nudge candidates"
          tone="amber"
        />
      </section>

      {/* Daily tap chart */}
      <section className="panel-strong p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Tap activity — last 14 days</h2>
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <Legend color="bg-emerald-400" label="granted" />
            <Legend color="bg-rose-400" label="denied" />
          </div>
        </div>
        <div className="mt-5 flex items-end gap-2 h-40">
          {(data?.daily ?? []).map((d) => {
            const total = d.granted + d.denied;
            const heightPct = total === 0 ? 4 : Math.max(6, (total / maxDaily) * 100);
            const grantedRatio = total === 0 ? 0 : d.granted / total;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div
                  className="w-full rounded-md overflow-hidden bg-bg-elevated relative ring-1 ring-bg-ring"
                  style={{ height: `${heightPct}%` }}
                  title={`${d.date}: ${d.granted} granted / ${d.denied} denied`}
                >
                  <div className="absolute bottom-0 left-0 right-0 bg-emerald-400/70" style={{ height: `${grantedRatio * 100}%` }} />
                  <div className="absolute top-0 left-0 right-0 bg-rose-400/70" style={{ height: `${(1 - grantedRatio) * 100}%` }} />
                </div>
                <div className="text-[9px] text-text-muted font-mono">{d.date.slice(5)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Two-column: expiring + denials */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel-strong p-6">
          <h2 className="font-display text-lg">Expiring soon</h2>
          <div className="mt-3 divide-y divide-bg-ring/50">
            {(data?.expiring ?? []).length === 0 ? (
              <div className="py-6 text-center text-sm text-text-muted">No subscriptions expiring in 14 days.</div>
            ) : (
              (data?.expiring ?? []).map((s) => {
                const days = Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                return (
                  <Link
                    key={s.id}
                    href={`/admin/drivers/${s.driver.id}`}
                    className="flex items-center justify-between py-3 hover:bg-bg-elevated/40 rounded -mx-2 px-2"
                  >
                    <div>
                      <div className="text-sm">{s.driver.fullName}</div>
                      <div className="text-[11px] text-text-muted font-mono">{s.driver.publicId} · {s.planName}</div>
                    </div>
                    <div className="text-right">
                      <div className={cn('text-sm tabular', days <= 3 ? 'text-rose-300' : days <= 7 ? 'text-amber-300' : 'text-text-primary')}>
                        {days}d left
                      </div>
                      <div className="text-[11px] text-text-muted">{new Date(s.expiresAt).toLocaleDateString()}</div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="panel-strong p-6">
          <h2 className="font-display text-lg">Denials (24h)</h2>
          <div className="mt-3 space-y-2">
            {(data?.denials.filter((d) => d.result !== 'GRANTED') ?? []).length === 0 ? (
              <div className="py-6 text-center text-sm text-text-muted">No denials in the last 24 hours.</div>
            ) : (
              data?.denials
                .filter((d) => d.result !== 'GRANTED')
                .map((d) => {
                  const maxCount = Math.max(...data.denials.filter((x) => x.result !== 'GRANTED').map((x) => x.count));
                  return (
                    <div key={d.result} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary">{d.result.replace('DENIED_', '').replaceAll('_', ' ').toLowerCase()}</span>
                        <span className="font-mono text-rose-300 tabular">{d.count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-bg-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-rose-400/60" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </section>

      {/* Exports */}
      <section className="panel-strong p-6">
        <h2 className="font-display text-lg">Exports</h2>
        <p className="text-text-muted text-sm mt-1">Download full data sets as CSV. Up to 10,000 rows per export.</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <ExportButton label="Drivers" path="/reports/export/drivers.csv" filename="drivers.csv" />
          <ExportButton label="Subscriptions" path="/reports/export/subscriptions.csv" filename="subscriptions.csv" />
          <ExportButton label="Tap History" path="/reports/export/taps.csv" filename="taps.csv" />
          <ExportButton label="Audit Logs" path="/reports/export/audit.csv" filename="audit.csv" />
        </div>
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-sm', color)} />
      {label}
    </span>
  );
}

function ExportButton({ label, path, filename }: { label: string; path: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const token = auth.get();
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={download}
      disabled={busy}
      className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring hover:bg-bg-panel px-4 py-3 text-sm flex items-center justify-between disabled:opacity-60"
    >
      <span>{label}</span>
      <span className="text-xs text-text-muted">{busy ? '…' : '↓ CSV'}</span>
    </button>
  );
}
