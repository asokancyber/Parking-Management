'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/ws';
import { cn } from '@/lib/cn';

type Gate = {
  id: string;
  code: string;
  name: string;
  direction: 'ENTRY' | 'EXIT' | 'BIDIRECTIONAL';
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  zone: string | null;
  capacity: number;
  occupancy: number;
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

export default function MonitorClient({ gate: initialGate }: { gate: Gate }) {
  const [gate, setGate] = useState(initialGate);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [flash, setFlash] = useState<Tap | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [wsConnected, setWsConnected] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const join = () => {
      socket.emit('gate:join', { gateId: gate.id });
      setWsConnected(true);
    };
    const onDisconnect = () => setWsConnected(false);
    const onTap = (t: Tap) => {
      setTaps((prev) => [t, ...prev].slice(0, 8));
      setFlash(t);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 2200);
      if (t.granted) {
        // Optimistic occupancy bump so the tile feels instant; server is source
        // of truth on next page load.
        setGate((g) => ({
          ...g,
          occupancy:
            g.direction === 'ENTRY'
              ? Math.min(g.capacity || Number.MAX_SAFE_INTEGER, g.occupancy + 1)
              : g.direction === 'EXIT'
                ? Math.max(0, g.occupancy - 1)
                : g.occupancy,
        }));
      }
    };

    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('tap', onTap);
    if (socket.connected) join();

    return () => {
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('tap', onTap);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [gate.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const slotsAvailable = Math.max(0, gate.capacity - gate.occupancy);
  const occupancyPct = gate.capacity > 0 ? Math.round((gate.occupancy / gate.capacity) * 100) : 0;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      {/* Full-screen flash overlay for the most recent tap. */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-0 z-20"
          >
            <div
              className={cn(
                'absolute -inset-20 blur-3xl opacity-40',
                flash.granted ? 'bg-emerald-500' : 'bg-rose-500',
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-10 py-6">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="leading-tight">
              <div className="font-display text-lg tracking-tight">ParkSphere Enterprise</div>
              <div className="text-xs text-text-secondary">RFID / NFC Access Control</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill ok={online} label={online ? 'INTERNET ONLINE' : 'OFFLINE'} />
            <StatusPill ok={wsConnected} label={wsConnected ? 'SYNC LIVE' : 'SYNC RECONNECTING'} />
            <StatusPill ok={gate.status === 'ONLINE'} label={`GATE ${gate.status}`} />
          </div>
        </header>

        <section className="px-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-text-secondary text-sm tracking-[0.3em] uppercase">
                {gate.direction} GATE — {gate.zone ?? 'Zone'}
              </div>
              <h1 className="font-display text-5xl mt-1 tracking-tight">{gate.name}</h1>
              <div className="text-text-secondary text-sm mt-1 font-mono">{gate.code}</div>
            </div>
            <Clock now={now} />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 px-10 py-8 flex-1">
          {/* Main "tap your card" panel */}
          <div className="panel-strong relative grid place-items-center overflow-hidden p-10">
            <AnimatePresence mode="wait">
              {flash ? (
                <ResultPanel key={flash.id} tap={flash} />
              ) : (
                <ReadyPanel key="ready" />
              )}
            </AnimatePresence>
          </div>

          {/* Side metrics + recent taps */}
          <div className="flex flex-col gap-6">
            <MetricTile
              label="Slots Available"
              value={slotsAvailable.toLocaleString()}
              sub={`${gate.occupancy}/${gate.capacity} occupied`}
              accent="cyan"
            />
            <MetricTile
              label="Live Occupancy"
              value={`${occupancyPct}%`}
              sub={
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-violet transition-all duration-700"
                    style={{ width: `${Math.min(100, occupancyPct)}%` }}
                  />
                </div>
              }
              accent="violet"
            />
            <div className="panel p-5 flex-1">
              <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">
                Recent taps
              </div>
              <div className="mt-3 space-y-2 max-h-[260px] overflow-hidden">
                {taps.length === 0 && (
                  <div className="text-sm text-text-muted py-6 text-center">
                    Waiting for the first tap…
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {taps.map((t) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring px-3 py-2"
                    >
                      <ResultDot granted={t.granted} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          {t.driverPublicId ? (
                            <span className="font-mono">{t.driverPublicId}</span>
                          ) : (
                            <span className="text-text-muted">unknown</span>
                          )}
                          {t.plate && <span className="text-text-secondary"> · {t.plate}</span>}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono">
                          UID {t.cardUid}
                          {!t.granted && t.reason ? ` · ${t.reason}` : ''}
                        </div>
                      </div>
                      <div className="text-xs text-text-muted font-mono">
                        {new Date(t.at).toLocaleTimeString([], { hour12: false })}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        <footer className="px-10 py-4 text-xs text-text-muted flex items-center justify-between">
          <div>ParkSphere Enterprise · RFID / NFC card access</div>
          <div className="font-mono">build: dev · session: monitor</div>
        </footer>
      </div>
    </main>
  );
}

// ───── sub-components ────────────────────────────────────────────────

function ReadyPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.25 }}
      className="text-center"
    >
      <NfcIcon />
      <div className="text-text-secondary text-xs tracking-[0.3em] uppercase mt-6">
        Ready
      </div>
      <h2 className="font-display text-6xl mt-2 tracking-tight">Tap your card</h2>
      <p className="text-text-muted text-sm mt-3 max-w-md mx-auto">
        Hold your ParkSphere card to the reader. The gate opens automatically once
        your subscription and vehicle are verified.
      </p>
    </motion.div>
  );
}

function ResultPanel({ tap }: { tap: Tap }) {
  const good = tap.granted;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.22 }}
      className="text-center"
    >
      <div
        className={cn(
          'mx-auto grid h-32 w-32 place-items-center rounded-full ring-4',
          good
            ? 'bg-emerald-500/15 ring-emerald-400/50 text-emerald-300'
            : 'bg-rose-500/15 ring-rose-400/50 text-rose-300',
        )}
      >
        <span className="font-display text-7xl leading-none">{good ? '✓' : '✕'}</span>
      </div>
      <div className="text-text-secondary text-xs tracking-[0.3em] uppercase mt-6">
        {good ? 'Granted' : 'Denied'}
      </div>
      <h2 className="font-display text-5xl mt-2 tracking-tight">
        {good ? 'Welcome' : reasonLabel(tap.result, tap.reason)}
      </h2>
      <div className="mt-4 text-text-secondary text-sm space-y-1">
        {tap.driverPublicId && (
          <div>
            Driver <span className="font-mono text-text-primary">{tap.driverPublicId}</span>
          </div>
        )}
        {tap.plate && (
          <div>
            Vehicle <span className="font-mono text-text-primary">{tap.plate}</span>
          </div>
        )}
        <div className="text-text-muted">
          Card UID <span className="font-mono">{tap.cardUid}</span>
        </div>
      </div>
    </motion.div>
  );
}

function NfcIcon() {
  return (
    <div className="relative mx-auto h-32 w-32">
      {/* Pulsing rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-accent-cyan/30"
          initial={{ scale: 0.4, opacity: 0.8 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 2, delay: i * 0.6, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-accent-cyan/30 to-accent-violet/30 ring-1 ring-accent-cyan/50">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-accent-cyan" fill="none">
            <path
              d="M6 9c2 2 2 4 0 6M9 6c4 4 4 8 0 12M12 4c6 5 6 11 0 16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="relative h-10 w-10 grid place-items-center rounded-xl bg-bg-elevated ring-1 ring-cyan-500/30">
      <div className="absolute inset-1 rounded-lg bg-gradient-to-br from-accent-cyan/40 to-accent-violet/40 blur-md" />
      <div className="relative font-display text-lg">P</div>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('pill', ok ? 'pill-online' : 'pill-offline')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-rose-400', 'animate-pulse-soft')} />
      {label}
    </span>
  );
}

function Clock({ now }: { now: number }) {
  const d = new Date(now);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <div className="text-right">
      <div className="font-mono text-3xl tabular">{time}</div>
      <div className="text-xs text-text-secondary">{date}</div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  accent: 'cyan' | 'violet';
}) {
  return (
    <div className={cn('panel-strong p-7', accent === 'violet' && 'shadow-violet')}>
      <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">{label}</div>
      <div className="font-display tabular text-6xl mt-2 leading-none">{value}</div>
      <div className="text-text-muted text-sm mt-3">{sub}</div>
    </div>
  );
}

function ResultDot({ granted }: { granted: boolean }) {
  return (
    <span
      className={cn(
        'h-2.5 w-2.5 rounded-full shrink-0',
        granted ? 'bg-emerald-400' : 'bg-rose-400',
      )}
    />
  );
}

function reasonLabel(result: string, reason: string | null) {
  const map: Record<string, string> = {
    DENIED_CARD_UNKNOWN: 'Card not registered',
    DENIED_CARD_INACTIVE: 'Card inactive',
    DENIED_CARD_LOST: 'Card reported lost',
    DENIED_CARD_BLACKLISTED: 'Card blacklisted',
    DENIED_CARD_EXPIRED: 'Card expired',
    DENIED_CARD_UNASSIGNED: 'Card not assigned',
    DENIED_NO_SUBSCRIPTION: 'No subscription',
    DENIED_SUBSCRIPTION_EXPIRED: 'Subscription expired',
    DENIED_SUBSCRIPTION_SUSPENDED: 'Subscription suspended',
    DENIED_VEHICLE_UNKNOWN: 'No vehicle on file',
    DENIED_GATE_OFFLINE: 'Gate offline',
    DENIED_GATE_UNAUTHORIZED: 'Reader unauthorised',
    ERROR: 'Read error',
  };
  return map[result] ?? reason ?? 'Denied';
}
