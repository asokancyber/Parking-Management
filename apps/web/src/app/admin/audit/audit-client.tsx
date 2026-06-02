'use client';

import { Fragment, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, SkeletonTable, EmptyState, ErrorBox, Paginator } from '@/components/ui';

type AuditRow = {
  id: string;
  category: string;
  action: string;
  actorId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
};

type ListResp = { items: AuditRow[]; total: number; skip: number; take: number };

const CATEGORIES = ['ALL', 'AUTH', 'CARD', 'TAP', 'GATE_COMMAND', 'SUBSCRIPTION', 'SETTINGS', 'ADMIN_ACTION'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_TONE: Record<string, string> = {
  AUTH: 'pill-info',
  CARD: 'pill-info',
  TAP: 'pill-online',
  GATE_COMMAND: 'pill-warn',
  SUBSCRIPTION: 'pill-info',
  SETTINGS: 'pill-info',
  ADMIN_ACTION: 'pill-warn',
};

export default function AuditClient() {
  const [data, setData] = useState<ListResp | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('ALL');
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 50;
  const [expanded, setExpanded] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('skip', String(skip));
      query.set('take', String(take));
      if (category !== 'ALL') query.set('category', category);
      if (search) query.set('search', search);
      const [list, s] = await Promise.all([
        api<ListResp>(`/audit?${query.toString()}`),
        api<Record<string, number>>('/audit/stats'),
      ]);
      setData(list);
      setStats(s);
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
  }, [skip, category]);

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
        eyebrow="Compliance"
        title="Audit Logs"
        description="Every admin action, every tap, every settings change. Append-only, queryable, exportable."
      />

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-bg-elevated ring-1 ring-bg-ring p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs flex items-center gap-2',
                category === c
                  ? 'bg-bg-panel text-text-primary ring-1 ring-cyan-500/30'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {c === 'ALL' ? 'All' : c.replaceAll('_', ' ').toLowerCase()}
              {c !== 'ALL' && stats[c] !== undefined && (
                <span className="text-[10px] text-text-muted tabular">{stats[c]}</span>
              )}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, target ID, metadata…"
          className="flex-1 min-w-[200px] rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-3 py-2 text-sm"
        />
      </div>

      <ErrorBox message={error} />

      {loading && !data ? (
        <SkeletonTable rows={10} cols={4} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No audit entries match" body="Try a different category or clear your search." />
      ) : (
        <>
          <div className="panel-strong overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Target</th>
                  <th className="text-left px-4 py-3 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-ring/50">
                {data.items.map((row) => (
                  // Fragment needs a key — two <tr>s per row, can't wrap in a div.
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      className="hover:bg-bg-elevated/40 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-text-secondary whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('pill', CATEGORY_TONE[row.category] ?? 'pill-info')}>
                          {row.category.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {row.targetType ? (
                          <>
                            {row.targetType}
                            {row.targetId && <span className="text-text-muted font-mono"> · {row.targetId.slice(-8)}</span>}
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {row.actorRole ? (
                          <>
                            <span className={cn('pill', row.actorRole === 'ADMIN' ? 'pill-info' : 'pill-online')}>
                              {row.actorRole.toLowerCase()}
                            </span>
                          </>
                        ) : (
                          <span className="text-text-muted">system</span>
                        )}
                      </td>
                    </tr>
                    {expanded === row.id && (
                      <tr className="bg-bg-base/50">
                        <td colSpan={5} className="px-4 py-3">
                          <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono overflow-x-auto">
                            {JSON.stringify({
                              actorId: row.actorId,
                              ip: row.ipAddress,
                              metadata: row.metadata,
                            }, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Paginator total={data.total} skip={data.skip} take={data.take} onChange={setSkip} />
        </>
      )}
    </div>
  );
}
