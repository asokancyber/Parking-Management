'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, SkeletonTable, EmptyState, ErrorBox } from '@/components/ui';

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  durationDays: number;
  description: string | null;
  active: boolean;
  createdAt: string;
};

export default function PlansClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const r = await api<Plan[]>('/plans?includeInactive=true');
      setPlans(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleActive(p: Plan) {
    setBusyId(p.id);
    try {
      await api(`/plans/${p.id}`, { method: 'PUT', body: { active: !p.active } });
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
        title="Subscription Plans"
        description="Pre-configured pricing tiers. Pick from these when creating a new subscription so operators don't re-enter prices each time."
        action={
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-4 py-2.5 text-sm font-medium text-black/90"
          >
            + New plan
          </button>
        }
      />

      <ErrorBox message={error} />

      {loading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : plans.length === 0 ? (
        <EmptyState title="No plans yet" body="Create your first pricing tier." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className={cn(
                'panel-strong p-6 relative overflow-hidden',
                !p.active && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-text-muted mt-1">{p.description}</div>
                  )}
                </div>
                <span className={cn('pill', p.active ? 'pill-online' : 'pill-offline')}>
                  {p.active ? 'active' : 'inactive'}
                </span>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-3xl tabular">RM {(p.priceCents / 100).toFixed(2)}</span>
                <span className="text-xs text-text-muted">/ {p.durationDays}d</span>
              </div>

              <div className="mt-5 flex gap-2 justify-end">
                <button
                  onClick={() => setEditing(p)}
                  className="rounded-md bg-bg-elevated ring-1 ring-bg-ring px-3 py-1.5 text-xs hover:bg-bg-panel"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  disabled={busyId === p.id}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs ring-1 disabled:opacity-50',
                    p.active
                      ? 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
                  )}
                >
                  {p.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {(creating || editing) && (
          <PlanModal
            plan={editing}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={async () => {
              setCreating(false);
              setEditing(null);
              await refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(plan?.name ?? '');
  const [priceMyr, setPriceMyr] = useState((plan?.priceCents ?? 12000) / 100);
  const [durationDays, setDurationDays] = useState(plan?.durationDays ?? 30);
  const [description, setDescription] = useState(plan?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name,
        priceCents: Math.round(priceMyr * 100),
        durationDays,
        description: description || undefined,
      };
      if (plan) {
        await api(`/plans/${plan.id}`, { method: 'PUT', body });
      } else {
        await api('/plans', { method: 'POST', body });
      }
      await onSaved();
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
        className="panel-strong w-full max-w-md p-7"
      >
        <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">
          {plan ? 'Edit plan' : 'New plan'}
        </div>
        <h2 className="font-display text-2xl mt-1">{plan ? plan.name : 'Create plan'}</h2>

        <label className="block mt-5 text-xs text-text-secondary">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
        />

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs text-text-secondary">Price (RM)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceMyr}
              onChange={(e) => setPriceMyr(Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary">Duration (days)</label>
            <input
              type="number"
              min={1}
              max={3650}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="block mt-4 text-xs text-text-secondary">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
        />

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
            {busy ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
