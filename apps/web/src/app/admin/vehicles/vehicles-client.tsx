'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, SkeletonTable, EmptyState, ErrorBox, Paginator } from '@/components/ui';

type Vehicle = {
  id: string;
  plate: string;
  type: string;
  active: boolean;
  createdAt: string;
  driver: { id: string; publicId: string; fullName: string } | null;
};

type ListResp = { items: Vehicle[]; total: number; skip: number; take: number };

export default function VehiclesClient() {
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const take = 25;

  async function refresh() {
    setError(null);
    try {
      const r = await api<ListResp>(`/vehicles?search=${encodeURIComponent(search)}&skip=${skip}&take=${take}`);
      setData(r);
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
  }, [skip]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSkip(0);
      void refresh();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function toggleActive(v: Vehicle) {
    setBusyId(v.id);
    try {
      await api(`/vehicles/${v.id}`, { method: 'PUT', body: { active: !v.active } });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Vehicles"
        description="Every plate registered to a driver. Deactivate to deny access without affecting the driver record."
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search plate, driver…"
        className="w-full rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-3 py-2 text-sm"
      />

      <ErrorBox message={error} />

      {loading && !data ? (
        <SkeletonTable rows={6} cols={4} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No vehicles match" body={search ? 'Try a different search.' : 'Add drivers first; vehicles are created with them.'} />
      ) : (
        <>
          <div className="panel-strong overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Plate</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Driver</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Added</th>
                  <th className="text-right px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-ring/50">
                {data.items.map((v) => (
                  <tr key={v.id} className="hover:bg-bg-elevated/40">
                    <td className="px-4 py-3 font-mono">{v.plate}</td>
                    <td className="px-4 py-3">{v.type}</td>
                    <td className="px-4 py-3">
                      {v.driver ? (
                        <Link href={`/admin/drivers/${v.driver.id}`} className="hover:underline">
                          <div className="text-sm">{v.driver.fullName}</div>
                          <div className="text-[11px] text-text-muted font-mono">{v.driver.publicId}</div>
                        </Link>
                      ) : (
                        <span className="text-text-muted text-xs">unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('pill', v.active ? 'pill-online' : 'pill-offline')}>
                        {v.active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{new Date(v.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleActive(v)}
                        disabled={busyId === v.id}
                        className={cn(
                          'rounded-md px-3 py-1 text-xs ring-1 disabled:opacity-50',
                          v.active
                            ? 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
                        )}
                      >
                        {v.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
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
