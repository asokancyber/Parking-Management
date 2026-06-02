'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { API_BASE_URL, API_PREFIX } from '@/lib/env';
import { cn } from '@/lib/cn';

type Gate = {
  id: string;
  code: string;
  name: string;
  direction: string;
  status: string;
  zone: string | null;
  capacity: number;
  occupancy: number;
  accessToken: string;
};

type Card = {
  id: string;
  uid: string;
  label: string | null;
  status: string;
  driver: { publicId: string; fullName: string } | null;
};

type TapOutcome = {
  result: string;
  granted: boolean;
  reason?: string;
  gate?: { code: string; name: string };
  driver?: { publicId: string; fullName: string };
  vehicle?: { plate: string };
  card?: { uid: string };
};

export default function GatesClient() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [revealedTokens, setRevealedTokens] = useState<Record<string, boolean>>({});
  const [simulateGate, setSimulateGate] = useState<Gate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await api<Gate[]>('/gates');
      setGates(list);
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Failed to load');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function rotate(id: string) {
    if (!window.confirm('Rotate the access token? The current reader will stop working until it is re-flashed with the new token.')) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await api(`/gates/${id}/rotate-token`, { method: 'POST' });
      await refresh();
      setRevealedTokens((r) => ({ ...r, [id]: true }));
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Rotate failed');
    } finally {
      setBusyId(null);
    }
  }

  async function manualOpen(g: Gate) {
    const reason = window.prompt(
      `Manually open ${g.name}?\n\nThis bypasses card validation and is fully audited. Enter a reason:`,
      'Operator override',
    );
    if (!reason) return;
    setBusyId(g.id);
    setError(null);
    try {
      await api(`/gates/${g.id}/manual-open`, { method: 'POST', body: { reason } });
      await refresh();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Manual open failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-7">
      <header>
        <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">Infrastructure</div>
        <h1 className="font-display text-4xl mt-1">Gates</h1>
        <p className="text-text-muted text-sm mt-2 max-w-2xl">
          Each gate has an access token presented by its physical RFID/NFC reader. Rotate the
          token if a reader is lost or compromised; the simulator lets you test tap flows without
          hardware.
        </p>
      </header>

      {error && <div className="text-rose-300 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {gates.map((g) => (
          <div key={g.id} className="panel-strong p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display text-xl">{g.name}</div>
                <div className="text-xs text-text-muted font-mono mt-1">
                  {g.code} · {g.direction}
                </div>
              </div>
              <span className={cn('pill', g.status === 'ONLINE' ? 'pill-online' : 'pill-offline')}>
                {g.status}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <Field label="Occupancy" value={`${g.occupancy} / ${g.capacity}`} />
              <Field label="Zone" value={g.zone ?? '—'} />
              <Field label="Direction" value={g.direction} />
            </div>

            <div className="mt-5">
              <div className="text-xs text-text-secondary tracking-[0.2em] uppercase">
                Reader access token
              </div>
              <TokenRow
                token={g.accessToken}
                revealed={!!revealedTokens[g.id]}
                onToggle={() => setRevealedTokens((r) => ({ ...r, [g.id]: !r[g.id] }))}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={`/gate/${g.code}/monitor`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-bg-elevated ring-1 ring-bg-ring px-3 py-1.5 text-xs hover:bg-bg-panel"
              >
                Open monitor display →
              </a>
              <button
                onClick={() => setSimulateGate(g)}
                className="rounded-md bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/40 hover:bg-accent-cyan/25 px-3 py-1.5 text-xs"
              >
                Simulate tap
              </button>
              <button
                onClick={() => manualOpen(g)}
                disabled={busyId === g.id}
                className="rounded-md bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Manual open
              </button>
              <button
                onClick={() => rotate(g.id)}
                disabled={busyId === g.id}
                className="rounded-md bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/20 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {busyId === g.id ? 'Rotating…' : 'Rotate token'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {simulateGate && (
          <SimulateModal
            gate={simulateGate}
            onClose={() => setSimulateGate(null)}
            onError={setError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TokenRow({
  token,
  revealed,
  onToggle,
}: {
  token: string;
  revealed: boolean;
  onToggle: () => void;
}) {
  const masked = `${token.slice(0, 4)}${'•'.repeat(Math.max(0, token.length - 8))}${token.slice(-4)}`;
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignored — clipboard permission denied
    }
  }
  return (
    <div className="mt-1 flex items-center gap-2 rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring px-3 py-2">
      <code className="flex-1 font-mono text-xs break-all">{revealed ? token : masked}</code>
      <button
        onClick={onToggle}
        className="rounded-md bg-bg-base ring-1 ring-bg-ring px-2 py-1 text-[10px] hover:bg-bg-panel"
      >
        {revealed ? 'Hide' : 'Show'}
      </button>
      <button
        onClick={copy}
        className="rounded-md bg-bg-base ring-1 ring-bg-ring px-2 py-1 text-[10px] hover:bg-bg-panel"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function SimulateModal({
  gate,
  onClose,
  onError,
}: {
  gate: Gate;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [uid, setUid] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TapOutcome | null>(null);

  useEffect(() => {
    api<Card[]>('/cards')
      .then((cs) => setCards(cs.filter((c) => c.driver)))
      .catch(() => {});
  }, []);

  async function tap() {
    if (!uid.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      // Call the public /card-access/tap endpoint directly with the gate's
      // access token. This is the SAME call a real RFID reader would make.
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/card-access/tap`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${gate.accessToken}`,
        },
        body: JSON.stringify({ cardUid: uid.trim() }),
      });
      const body = (await res.json()) as TapOutcome & { message?: string };
      if (!res.ok) {
        onError(body.message ?? 'Tap failed');
      }
      setResult(body);
    } catch (e) {
      onError((e as Error).message ?? 'Tap failed');
    } finally {
      setBusy(false);
    }
  }

  const knownUids = useMemo(() => cards.slice(0, 8), [cards]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="panel-strong w-full max-w-lg p-7"
      >
        <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">Simulate tap</div>
        <h2 className="font-display text-2xl mt-1">{gate.name}</h2>
        <p className="text-text-muted text-sm mt-2">
          Posts to <code className="font-mono">/card-access/tap</code> with this gate's access
          token — same shape a real RFID reader would use.
        </p>

        <label className="block mt-5 text-xs text-text-secondary">Card UID</label>
        <input
          autoFocus
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          placeholder="Type any UID — known cards grant, unknown ones deny"
          className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm font-mono"
        />

        {knownUids.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] text-text-muted uppercase tracking-[0.2em] mb-2">
              Quick pick — assigned cards
            </div>
            <div className="flex flex-wrap gap-1.5">
              {knownUids.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setUid(c.uid)}
                  className="rounded-full bg-bg-elevated ring-1 ring-bg-ring hover:ring-accent-cyan/50 px-2.5 py-1 text-[11px]"
                  title={c.driver ? `${c.driver.publicId} · ${c.driver.fullName}` : c.uid}
                >
                  <span className="font-mono">{c.uid}</span>{' '}
                  <span className="text-text-muted">· {c.driver?.publicId}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2.5 text-sm"
          >
            Close
          </button>
          <button
            onClick={tap}
            disabled={busy || !uid.trim()}
            className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2.5 text-sm font-medium text-black/90 disabled:opacity-50"
          >
            {busy ? 'Tapping…' : 'Tap card'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'mt-5 rounded-lg p-4 ring-1',
                result.granted
                  ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 ring-rose-500/30 text-rose-200',
              )}
            >
              <div className="font-display text-lg">
                {result.granted ? '✓ Gate opened' : '✕ ' + (result.reason ?? 'Denied')}
              </div>
              <div className="text-xs mt-1 font-mono">{result.result}</div>
              {result.driver && (
                <div className="text-xs mt-2">
                  {result.driver.publicId} · {result.driver.fullName}
                  {result.vehicle && ` · ${result.vehicle.plate}`}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className="text-sm mt-1">{value}</div>
    </div>
  );
}
