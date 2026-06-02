'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, SkeletonTable, EmptyState, ErrorBox, Paginator } from '@/components/ui';

type Driver = {
  id: string;
  publicId: string;
  fullName: string;
  phone: string;
  company: string | null;
  createdAt: string;
  user: { email: string; role: string };
  vehicles: Array<{ id: string; plate: string; type: string }>;
  subscriptions: Array<{ id: string; planName: string; status: string; expiresAt: string }>;
  cards: Array<{ id: string; uid: string; status: string }>;
};

type ListResp = { items: Driver[]; total: number; skip: number; take: number };

export default function DriversClient() {
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 25;
  const [showCreate, setShowCreate] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const r = await api<ListResp>(`/drivers?search=${encodeURIComponent(search)}&skip=${skip}&take=${take}`);
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Drivers"
        description="Everyone authorised to enter. Search by name, plate, email, phone, or driver ID."
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-4 py-2.5 text-sm font-medium text-black/90"
          >
            + Add driver
          </button>
        }
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search drivers…"
        className="w-full rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-3 py-2 text-sm"
      />

      <ErrorBox message={error} />

      {loading && !data ? (
        <SkeletonTable rows={6} cols={5} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={search ? 'No drivers match your search' : 'No drivers yet'}
          body={search ? undefined : 'Add your first driver to get started.'}
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/40 px-4 py-2 text-sm"
            >
              + Add driver
            </button>
          }
        />
      ) : (
        <>
          <div className="panel-strong overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Driver</th>
                  <th className="text-left px-4 py-3 font-medium">Contact</th>
                  <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                  <th className="text-left px-4 py-3 font-medium">Subscription</th>
                  <th className="text-left px-4 py-3 font-medium">Cards</th>
                  <th className="text-right px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-ring/50">
                {data.items.map((d) => {
                  const sub = d.subscriptions[0];
                  const vehicle = d.vehicles[0];
                  return (
                    <tr key={d.id} className="hover:bg-bg-elevated/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{d.fullName}</div>
                        <div className="text-xs text-text-muted font-mono">{d.publicId}</div>
                        {d.company && <div className="text-[11px] text-text-muted">{d.company}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-text-secondary">{d.user.email}</div>
                        <div className="text-text-muted font-mono mt-0.5">{d.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {vehicle ? (
                          <>
                            <div className="font-mono">{vehicle.plate}</div>
                            <div className="text-[11px] text-text-muted">{vehicle.type}</div>
                          </>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub ? <SubBadge status={sub.status} expiresAt={sub.expiresAt} planName={sub.planName} /> : <span className="text-text-muted text-xs">none</span>}
                      </td>
                      <td className="px-4 py-3">
                        {d.cards.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {d.cards.slice(0, 2).map((c) => (
                              <span key={c.id} className="font-mono text-[11px]">{c.uid}</span>
                            ))}
                            {d.cards.length > 2 && (
                              <span className="text-[11px] text-text-muted">+{d.cards.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">none</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/drivers/${d.id}`}
                          className="text-accent-cyan hover:underline text-xs"
                        >
                          Open →
                        </Link>
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
        {showCreate && (
          <CreateDriverModal
            onClose={() => setShowCreate(false)}
            onCreated={async () => {
              setShowCreate(false);
              await refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SubBadge({ status, expiresAt, planName }: { status: string; expiresAt: string; planName: string }) {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const tone =
    status === 'ACTIVE' ? (days <= 7 ? 'pill-warn' : 'pill-online') : status === 'EXPIRED' ? 'pill-offline' : 'pill-info';
  return (
    <div>
      <span className={cn('pill', tone)}>{status.toLowerCase().replaceAll('_', ' ')}</span>
      <div className="text-[11px] text-text-muted mt-1">
        {planName} · {days > 0 ? `${days}d left` : `${Math.abs(days)}d overdue`}
      </div>
    </div>
  );
}

function CreateDriverModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: 'parksphere-driver',
    company: '',
    vehiclePlate: '',
    vehicleType: 'CAR' as 'CAR' | 'LORRY' | 'VAN' | 'MOTORCYCLE',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/drivers', { method: 'POST', body: form });
      await onCreated();
    } catch (e) {
      setError(errorMessage(e));
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
        className="panel-strong w-full max-w-lg p-7"
      >
        <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">New driver</div>
        <h2 className="font-display text-2xl mt-1">Add driver</h2>
        <p className="text-text-muted text-sm mt-2">
          Creates the driver, their login, and registers their primary vehicle. Assign a subscription and card afterwards.
        </p>

        <div className="grid grid-cols-2 gap-4 mt-5">
          <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required placeholder="+60123456789" />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Field label="Password (temporary)" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Field label="Plate" value={form.vehiclePlate} onChange={(v) => setForm({ ...form, vehiclePlate: v })} required placeholder="WXY1234" />
          <SelectField
            label="Vehicle type"
            value={form.vehicleType}
            onChange={(v) => setForm({ ...form, vehicleType: v as 'CAR' })}
            options={['CAR', 'LORRY', 'VAN', 'MOTORCYCLE']}
          />
          <Field label="Company (optional)" value={form.company} onChange={(v) => setForm({ ...form, company: v })} className="col-span-2" />
        </div>

        <ErrorBox message={error} />

        <div className="mt-6 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2.5 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2.5 text-sm font-medium text-black/90 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create driver'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
