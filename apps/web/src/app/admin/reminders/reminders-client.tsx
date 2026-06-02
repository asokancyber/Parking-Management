'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, StatTile, SkeletonTable, EmptyState, ErrorBox, Paginator } from '@/components/ui';

type Reminder = {
  id: string;
  driverId: string;
  subscriptionId: string;
  kind: string;
  channel: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  attempts: number;
  failReason: string | null;
  externalId: string | null;
  renderedBody: string | null;
  recipientPhone: string | null;
  createdAt: string;
  driver: { publicId: string; fullName: string; phone: string };
  subscription: { planName: string; expiresAt: string };
};

type ListResp = { items: Reminder[]; total: number; skip: number; take: number };

type Config = {
  whatsapp: { mode: 'live' | 'dry'; live: boolean; instructions: string };
  templates: Array<{ kind: string; name: string; preview: string }>;
};

type ReminderSchedule = {
  daysBeforeExpiry: number[];
  includeGrace: boolean;
  includeLapsed: boolean;
  hourOfDay: number;
};

type AllSettings = {
  tapDebounceMs?: number;
  reminderSchedule: ReminderSchedule;
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'SENT', label: 'Sent' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'DRY_RUN', label: 'Dry-run' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];

const KIND_LABELS: Record<string, string> = {
  T_MINUS_14: 'T-14 days',
  T_MINUS_7: 'T-7 days',
  T_MINUS_3: 'T-3 days',
  T_MINUS_1: 'T-1 day',
  T_ZERO: 'Day of expiry',
  GRACE_1: 'Grace day 1',
  LAPSED: 'Lapsed',
  MANUAL: 'Manual',
};

export default function RemindersClient() {
  const [data, setData] = useState<ListResp | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [schedule, setSchedule] = useState<ReminderSchedule | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSchedule, setShowSchedule] = useState(true);
  const take = 50;

  async function refresh() {
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set('skip', String(skip));
      q.set('take', String(take));
      if (filter !== 'all') q.set('status', filter);
      const [list, s, c, settings] = await Promise.all([
        api<ListResp>(`/reminders?${q.toString()}`),
        api<{ byStatus: Record<string, number> }>('/reminders/stats'),
        config ? Promise.resolve(config) : api<Config>('/reminders/config'),
        api<AllSettings>('/settings', { auth: false }),
      ]);
      setData(list);
      setStats(s.byStatus);
      if (!config) setConfig(c as Config);
      setSchedule(settings.reminderSchedule);
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

  async function sendNow(r: Reminder) {
    setBusyId(r.id);
    try {
      await api(`/reminders/${r.id}/send-now`, { method: 'POST' });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(r: Reminder) {
    if (!window.confirm('Cancel this reminder?')) return;
    setBusyId(r.id);
    try {
      await api(`/reminders/${r.id}/cancel`, { method: 'POST' });
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
        eyebrow="Operations"
        title="Reminders"
        description="Every renewal nudge that's been scheduled, sent, or failed — across WhatsApp, SMS, and email channels."
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowSchedule((v) => !v)}
              className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2 text-sm hover:bg-bg-panel"
            >
              {showSchedule ? 'Hide' : 'Edit'} schedule
            </button>
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2 text-sm hover:bg-bg-panel"
            >
              {showTemplates ? 'Hide' : 'Show'} templates
            </button>
          </div>
        }
      />

      {showSchedule && schedule && (
        <ScheduleEditor
          schedule={schedule}
          onSaved={async (next) => {
            setSchedule(next);
            await refresh();
          }}
          onError={setError}
        />
      )}

      {/* WhatsApp config status */}
      {config && (
        <div
          className={cn(
            'panel p-4 ring-1',
            config.whatsapp.live
              ? 'ring-emerald-500/30 bg-emerald-500/5'
              : 'ring-amber-500/30 bg-amber-500/5',
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'grid h-9 w-9 place-items-center rounded-lg shrink-0 ring-1',
                config.whatsapp.live
                  ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
              )}
            >
              {config.whatsapp.live ? '✓' : '!'}
            </div>
            <div className="flex-1">
              <div className="font-display text-sm">
                WhatsApp · {config.whatsapp.live ? 'LIVE' : 'DRY-RUN'}
              </div>
              <div className="text-xs text-text-secondary mt-1">{config.whatsapp.instructions}</div>
            </div>
            <span className={cn('pill', config.whatsapp.live ? 'pill-online' : 'pill-warn')}>
              {config.whatsapp.live ? 'live' : 'dry'}
            </span>
          </div>
        </div>
      )}

      {/* Templates collapsible */}
      {showTemplates && config && (
        <div className="panel-strong p-5">
          <div className="text-xs text-text-secondary tracking-[0.3em] uppercase mb-3">Templates</div>
          <div className="space-y-3">
            {config.templates.map((t) => (
              <div key={t.kind} className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm">{KIND_LABELS[t.kind] ?? t.kind}</span>
                  <span className="text-xs text-text-muted font-mono">{t.name}</span>
                </div>
                <div className="text-xs text-text-secondary mt-2 whitespace-pre-wrap leading-relaxed">
                  {t.preview}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Scheduled" value={stats.SCHEDULED ?? 0} tone="cyan" />
        <StatTile label="Sent / Delivered" value={(stats.SENT ?? 0) + (stats.DELIVERED ?? 0)} tone="emerald" />
        <StatTile label="Dry-run" value={stats.DRY_RUN ?? 0} tone="amber" />
        <StatTile label="Failed" value={stats.FAILED ?? 0} tone="rose" />
      </div>

      <div className="flex gap-1 rounded-lg bg-bg-elevated ring-1 ring-bg-ring p-1 w-fit">
        {STATUS_FILTERS.map((f) => (
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

      <ErrorBox message={error} />

      {loading && !data ? (
        <SkeletonTable rows={8} cols={4} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No reminders yet"
          body="Reminders are scheduled automatically when subscriptions are created or renewed. Create or renew one to see them appear here."
        />
      ) : (
        <>
          <div className="panel-strong overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/60 text-text-secondary text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">Kind</th>
                  <th className="text-left px-4 py-3 font-medium">Channel</th>
                  <th className="text-left px-4 py-3 font-medium">Driver</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-ring/50">
                {data.items.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      className={cn('hover:bg-bg-elevated/40 cursor-pointer', expanded === r.id && 'bg-bg-elevated/50')}
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">
                        {new Date(r.scheduledFor).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs">{KIND_LABELS[r.kind] ?? r.kind}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="pill pill-info">{r.channel.toLowerCase()}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Link href={`/admin/drivers/${r.driverId}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                          <div>{r.driver.fullName}</div>
                          <div className="text-text-muted font-mono">{r.driver.publicId}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={r.status} attempts={r.attempts} /></td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'SCHEDULED' && (
                          <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => sendNow(r)}
                              className="rounded-md bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/40 px-2.5 py-1 text-xs disabled:opacity-50"
                            >
                              Send now
                            </button>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => cancel(r)}
                              className="rounded-md bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30 px-2.5 py-1 text-xs disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr className="bg-bg-base/50">
                        <td colSpan={6} className="px-4 py-4 text-xs space-y-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-text-secondary">
                            <Field label="Recipient" value={r.recipientPhone ?? r.driver.phone} mono />
                            <Field label="Attempts" value={String(r.attempts)} />
                            <Field label="External ID" value={r.externalId ?? '—'} mono />
                            <Field label="Sub plan" value={r.subscription.planName} />
                            <Field label="Sent at" value={r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'} />
                            <Field label="Delivered at" value={r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : '—'} />
                            <Field label="Failed at" value={r.failedAt ? new Date(r.failedAt).toLocaleString() : '—'} />
                            <Field label="Fail reason" value={r.failReason ?? '—'} />
                          </div>
                          {r.renderedBody && (
                            <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3 mt-3">
                              <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted mb-2">Rendered message</div>
                              <div className="whitespace-pre-wrap text-text-primary leading-relaxed">{r.renderedBody}</div>
                            </div>
                          )}
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className={cn('mt-0.5', mono && 'font-mono')}>{value}</div>
    </div>
  );
}

// ─────────────────────────── ScheduleEditor ────────────────────────────────
// Lets the operator pick which "X days before expiry" reminders to send + how
// far into grace/lapsed to nudge. Quick chips for common values (14, 7, 3, 1,
// 0) plus a custom-day input. Save persists the setting; "Regenerate" applies
// the new schedule to every currently-active subscription (cancels their old
// pending reminders, schedules fresh ones).

const PRESET_DAYS = [14, 7, 3, 1, 0];

function ScheduleEditor({
  schedule,
  onSaved,
  onError,
}: {
  schedule: ReminderSchedule;
  onSaved: (next: ReminderSchedule) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [days, setDays] = useState<number[]>(schedule.daysBeforeExpiry);
  const [grace, setGrace] = useState<boolean>(schedule.includeGrace);
  const [lapsed, setLapsed] = useState<boolean>(schedule.includeLapsed);
  const [hour, setHour] = useState<number>(schedule.hourOfDay);
  const [customDay, setCustomDay] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const a = [...days].sort((x, y) => x - y).join(',');
    const b = [...schedule.daysBeforeExpiry].sort((x, y) => x - y).join(',');
    return a !== b || grace !== schedule.includeGrace || lapsed !== schedule.includeLapsed || hour !== schedule.hourOfDay;
  }, [days, grace, lapsed, hour, schedule]);

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => b - a)));
  }
  function addCustom() {
    const n = Number(customDay);
    if (!Number.isFinite(n) || n < 0 || n > 365) return;
    if (!days.includes(n)) setDays([...days, n].sort((a, b) => b - a));
    setCustomDay('');
  }
  function removeDay(d: number) {
    setDays(days.filter((x) => x !== d));
  }

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ reminderSchedule: ReminderSchedule }>('/settings/reminder-schedule', {
        method: 'PUT',
        body: { daysBeforeExpiry: days, includeGrace: grace, includeLapsed: lapsed, hourOfDay: hour },
      });
      await onSaved(r.reminderSchedule);
      setToast('Schedule saved.');
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!window.confirm(
      'Regenerate reminders for every active subscription? ' +
      'Pending reminders will be cancelled and replaced with the current schedule.',
    )) return;
    setRegenerating(true);
    try {
      const r = await api<{ cancelled: number; subsTouched: number; scheduled: number }>('/reminders/regenerate', {
        method: 'POST',
      });
      setToast(`Regenerated · ${r.subsTouched} sub(s) · ${r.cancelled} cancelled · ${r.scheduled} new`);
      setTimeout(() => setToast(null), 4000);
      await onSaved(schedule);  // triggers refresh in parent
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="panel-strong p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-display text-lg">Reminder schedule</h3>
          <p className="text-text-muted text-xs mt-1 max-w-xl">
            Pick which days before expiry to send a reminder. Default: 3 and 1 days. Add custom days too. Sent at the chosen hour, in the driver's preferred channel.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {toast && <span className="text-emerald-300">{toast}</span>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Days picker */}
        <div>
          <div className="text-xs text-text-secondary tracking-[0.2em] uppercase mb-2">Days before expiry</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_DAYS.map((d) => {
              const active = days.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs ring-1 transition',
                    active
                      ? 'bg-accent-cyan/20 text-accent-cyan ring-accent-cyan/40'
                      : 'bg-bg-elevated text-text-secondary ring-bg-ring hover:text-text-primary',
                  )}
                >
                  {d === 0 ? 'Day of expiry' : `${d} day${d === 1 ? '' : 's'} before`}
                </button>
              );
            })}
          </div>

          {/* Custom days currently active (anything not in PRESETS) */}
          {days.filter((d) => !PRESET_DAYS.includes(d)).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {days.filter((d) => !PRESET_DAYS.includes(d)).map((d) => (
                <button
                  key={d}
                  onClick={() => removeDay(d)}
                  className="rounded-full px-3 py-1.5 text-xs ring-1 bg-accent-violet/20 text-accent-violet ring-accent-violet/40 hover:bg-accent-violet/30 inline-flex items-center gap-1.5"
                >
                  {d} days before
                  <span className="text-[10px] opacity-70">×</span>
                </button>
              ))}
            </div>
          )}

          {/* Add custom */}
          <div className="mt-4 flex gap-2">
            <input
              type="number"
              min={0}
              max={365}
              value={customDay}
              onChange={(e) => setCustomDay(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder="e.g. 5"
              className="w-32 rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
            />
            <button
              onClick={addCustom}
              disabled={!customDay}
              className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2 text-sm hover:bg-bg-panel disabled:opacity-50"
            >
              + Add custom day
            </button>
          </div>

          {days.length === 0 && (
            <div className="mt-3 text-xs text-rose-300">
              No days selected — no pre-expiry reminders will be sent.
            </div>
          )}
        </div>

        {/* Post-expiry + hour */}
        <div className="space-y-4">
          <div>
            <div className="text-xs text-text-secondary tracking-[0.2em] uppercase mb-2">Post-expiry reminders</div>
            <div className="space-y-2">
              <ToggleRow label="Send during grace period (day 1)" value={grace} onChange={setGrace} />
              <ToggleRow label="Send when subscription lapses" value={lapsed} onChange={setLapsed} />
            </div>
          </div>

          <div>
            <div className="text-xs text-text-secondary tracking-[0.2em] uppercase mb-2">Time of day</div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setHour(Math.max(0, Math.min(23, Number(e.target.value))))}
                className="w-24 rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
              />
              <span className="text-xs text-text-muted">{hour.toString().padStart(2, '0')}:00 local time</span>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3 text-xs">
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted mb-1.5">Preview</div>
            <div className="text-text-secondary">
              For a sub expiring on <span className="font-mono text-text-primary">15 Jul</span> with the current schedule, reminders will fire at:
            </div>
            <ul className="mt-2 space-y-0.5 font-mono text-text-primary">
              {days.sort((a, b) => b - a).map((d) => (
                <li key={d}>· {d === 0 ? '15 Jul' : `${15 - d > 0 ? `${15 - d} Jul` : `${30 + (15 - d)} Jun`}`} {hour.toString().padStart(2, '0')}:00 — T-{d}</li>
              ))}
              {grace && <li>· 16 Jul {hour.toString().padStart(2, '0')}:00 — grace</li>}
              {lapsed && <li>· later — lapsed (after grace period ends)</li>}
              {days.length === 0 && !grace && !lapsed && <li className="text-rose-300">(no reminders configured)</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          onClick={regenerate}
          disabled={regenerating || dirty}
          title={dirty ? 'Save the schedule first' : 'Apply current schedule to all active subscriptions'}
          className="rounded-lg bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/20 px-4 py-2 text-sm disabled:opacity-50"
        >
          {regenerating ? 'Regenerating…' : 'Regenerate for active subs'}
        </button>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2 text-sm font-medium text-black/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save schedule'}
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring px-3 py-2 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        onClick={(e) => { e.preventDefault(); onChange(!value); }}
        className={cn(
          'relative h-5 w-9 rounded-full ring-1 transition',
          value ? 'bg-accent-cyan/40 ring-accent-cyan/60' : 'bg-bg-base ring-bg-ring',
        )}
        aria-pressed={value}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-text-primary transition-transform',
            value ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

function StatusPill({ status, attempts }: { status: string; attempts: number }) {
  const tone =
    status === 'DELIVERED' || status === 'SENT' ? 'pill-online'
    : status === 'DRY_RUN' ? 'pill-warn'
    : status === 'FAILED' ? 'pill-offline'
    : status === 'CANCELLED' ? 'pill-offline'
    : 'pill-info';
  return (
    <span className={cn('pill', tone)}>
      {status.toLowerCase()}
      {attempts > 0 && status === 'SCHEDULED' && <> · retry #{attempts}</>}
    </span>
  );
}
