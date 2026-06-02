'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/ws';
import { cn } from '@/lib/cn';

const PRESETS = [0, 500, 1500, 3000, 10_000];
const MIN = 0;
const MAX = 60_000;

// Single configurable setting in this build: tap debounce. Stops a card from
// counting twice if a driver double-taps the reader within the window.
export default function SettingsClient() {
  const [ms, setMs] = useState<number>(1500);
  const [draft, setDraft] = useState<number>(1500);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ tapDebounceMs: number }>('/settings', { auth: false })
      .then((r) => {
        setMs(r.tapDebounceMs);
        setDraft(r.tapDebounceMs);
      })
      .catch((e) => setError((e as { message?: string }).message ?? 'Failed to load'))
      .finally(() => setLoading(false));

    const socket = getSocket();
    const onChange = (ev: { key: string; value: unknown }) => {
      if (ev.key === 'tapDebounceMs' && typeof ev.value === 'number') {
        setMs(ev.value);
        setDraft(ev.value);
      }
    };
    socket.on('setting:changed', onChange);
    return () => {
      socket.off('setting:changed', onChange);
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ tapDebounceMs: number }>('/settings/tap-debounce', {
        method: 'PUT',
        body: { ms: draft },
      });
      setMs(r.tapDebounceMs);
      setToast('Saved.');
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-text-muted">Loading…</div>;
  const dirty = draft !== ms;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">Configuration</div>
        <h1 className="font-display text-4xl mt-1">Tap Debounce</h1>
        <p className="text-text-muted text-sm mt-2 max-w-lg">
          Minimum interval between accepted taps of the same card on the same gate. Stops a
          driver from double-tapping the reader and double-incrementing occupancy. Set to 0 to
          disable.
        </p>
      </header>

      <div className="panel-strong p-7">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">Current</div>
            <div className="font-display text-6xl tabular mt-1">
              {ms}
              <span className="text-text-muted text-2xl"> ms</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">Draft</div>
            <div className={cn('font-display text-4xl tabular mt-1', dirty && 'text-accent-cyan')}>
              {draft} ms
            </div>
          </div>
        </div>

        <input
          type="range"
          min={MIN}
          max={MAX}
          step={100}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          className="mt-6 w-full accent-cyan-400"
        />
        <div className="flex justify-between text-xs text-text-muted mt-1">
          <span>0 ms (off)</span>
          <span>60 s</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setDraft(p)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs ring-1',
                draft === p
                  ? 'bg-accent-cyan/20 text-accent-cyan ring-accent-cyan/40'
                  : 'bg-bg-elevated text-text-secondary ring-bg-ring hover:text-text-primary',
              )}
            >
              {p === 0 ? 'Off' : `${p}ms`}
            </button>
          ))}
        </div>

        <div className="mt-7 flex items-center gap-3">
          <button
            disabled={!dirty || saving}
            onClick={save}
            className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2.5 text-sm font-medium text-black/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Apply'}
          </button>
          <button
            disabled={!dirty || saving}
            onClick={() => setDraft(ms)}
            className="rounded-lg bg-bg-elevated px-4 py-2.5 text-sm ring-1 ring-bg-ring disabled:opacity-50"
          >
            Reset
          </button>
          {toast && <span className="text-emerald-300 text-sm">{toast}</span>}
          {error && <span className="text-rose-300 text-sm">{error}</span>}
        </div>
      </div>
    </div>
  );
}
