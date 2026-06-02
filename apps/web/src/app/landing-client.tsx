'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

// ──────────────────────────────────────────────────────────────────────
// LANDING CLIENT
// All sections below the sticky nav. Designed for a "first look" client
// demo: dense, animated, opinionated. Pulls real data from the public
// /health endpoint when available (proves the system is live) and falls
// back to credible static numbers when not.
// ──────────────────────────────────────────────────────────────────────

export default function LandingClient() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Stack />
      <FinalCta />
      <Footer />
    </>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-bg-elevated ring-1 ring-cyan-500/30 px-3 py-1 text-xs text-cyan-600 dark:text-cyan-300"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Enterprise Smart Vehicle Access Control
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-display text-5xl md:text-7xl tracking-tight mt-6 leading-[0.95]"
          >
            Tap.
            <br />
            <span className="bg-gradient-to-r from-accent-cyan via-accent-violet to-accent-cyan bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradient-shift_8s_ease_infinite]">
              Enter.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-text-secondary text-lg mt-6 max-w-xl"
          >
            RFID / NFC card-based parking access for factories, warehouses, and logistics hubs.
            Subscription-billed monthly. Every tap validated in <span className="text-text-primary font-medium">under 200&nbsp;ms</span> against
            the driver's card, vehicle, and subscription — recorded forever.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-10 flex flex-wrap gap-3"
          >
            <Link
              href="/admin/dashboard"
              className="group rounded-xl bg-gradient-to-r from-accent-cyan to-accent-violet px-6 py-3 font-medium text-black/90 inline-flex items-center gap-2"
            >
              Open command center
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/gate/GATE-A-ENTRY/monitor"
              className="rounded-xl bg-bg-elevated ring-1 ring-bg-ring px-6 py-3 text-text-primary hover:bg-bg-panel"
            >
              View gate monitor
            </Link>
            <Link
              href="/admin/onboard"
              className="rounded-xl bg-bg-elevated ring-1 ring-bg-ring px-6 py-3 text-text-primary hover:bg-bg-panel"
            >
              Onboard a driver
            </Link>
          </motion.div>
        </div>

        {/* Live demo card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="relative"
        >
          <LiveDemoCard />
        </motion.div>
      </div>

      {/* Scroll-shifting gradient keyframe */}
      <style jsx global>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  );
}

// ─── Live demo card — animated mock RFID tap stream ──────────────────
function LiveDemoCard() {
  // Three scripted scenarios that cycle every ~3.5s. Each shows what the
  // gate monitor would display for that kind of tap.
  const SCENARIOS = useMemo(
    () => [
      {
        kind: 'granted' as const,
        driver: 'RAJU7690QW',
        name: 'Raju Kumaran',
        plate: 'WXY1234',
        card: 'PSC-001',
        gate: 'GATE-A-ENTRY',
        latency: 184,
        message: 'Welcome',
      },
      {
        kind: 'granted' as const,
        driver: 'AHMA2210ZK',
        name: 'Ahmad Faizal',
        plate: 'WTC7788',
        card: 'PSC-002',
        gate: 'GATE-A-ENTRY',
        latency: 167,
        message: 'Welcome',
      },
      {
        kind: 'denied' as const,
        driver: 'TANW0090PQ',
        name: 'Tan Wei Ming',
        plate: 'JPK3300',
        card: 'PSC-004',
        gate: 'GATE-A-ENTRY',
        latency: 192,
        message: 'Subscription expired',
      },
    ],
    [],
  );

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SCENARIOS.length), 3600);
    return () => clearInterval(t);
  }, [SCENARIOS.length]);

  // Wall clock — rendered client-only to avoid hydration mismatch. The server
  // would render at one second, the browser hydrates at the next second, and
  // React errors. Empty initial value, populated after mount.
  const [clock, setClock] = useState('');
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString([], { hour12: false }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const s = SCENARIOS[idx];
  const granted = s.kind === 'granted';

  return (
    <div className="relative">
      {/* Glow behind card */}
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-accent-cyan/20 via-transparent to-accent-violet/20 blur-2xl" />

      <div className="relative panel-strong p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft" />
            <span className="text-xs text-text-secondary tracking-[0.2em] uppercase">Gate monitor · live</span>
          </div>
          <div className="text-[10px] text-text-muted font-mono">{s.gate}</div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Result block */}
            <div
              className={cn(
                'rounded-xl p-5 ring-1',
                granted
                  ? 'bg-emerald-500/10 ring-emerald-500/40'
                  : 'bg-rose-500/10 ring-rose-500/40',
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'grid h-14 w-14 place-items-center rounded-2xl font-display text-3xl ring-2',
                    granted
                      ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/50'
                      : 'bg-rose-500/20 text-rose-300 ring-rose-400/50',
                  )}
                >
                  {granted ? '✓' : '✕'}
                </div>
                <div>
                  <div className="text-[10px] text-text-secondary tracking-[0.2em] uppercase">
                    {granted ? 'Granted' : 'Denied'}
                  </div>
                  <div className="font-display text-2xl mt-0.5">{s.message}</div>
                </div>
              </div>
            </div>

            {/* Card / driver / vehicle row */}
            <div className="grid grid-cols-3 gap-2">
              <MiniCell label="Card UID" value={s.card} />
              <MiniCell label="Driver" value={s.driver} />
              <MiniCell label="Vehicle" value={s.plate} />
            </div>

            {/* Validation pipeline */}
            <div className="rounded-xl bg-bg-elevated/60 ring-1 ring-bg-ring p-4">
              <div className="text-[10px] text-text-secondary tracking-[0.2em] uppercase mb-3">
                Validated in {s.latency} ms
              </div>
              <div className="flex items-center gap-1.5">
                <PipelineDot ok label="card" />
                <PipelineLine ok />
                <PipelineDot ok label="vehicle" />
                <PipelineLine ok />
                <PipelineDot ok={granted} label="sub" />
                <PipelineLine ok={granted} />
                <PipelineDot ok={granted} label="gate" />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 flex items-center justify-between text-[10px] text-text-muted font-mono">
          <span>POST /api/v1/card-access/tap</span>
          {/* suppressHydrationWarning: the empty initial value matches between
              server + client; the useEffect populates it post-hydration. */}
          <span suppressHydrationWarning>{clock || '—'}</span>
        </div>
      </div>
    </div>
  );
}

function MiniCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className="text-xs font-mono mt-0.5 truncate">{value}</div>
    </div>
  );
}
function PipelineDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold ring-1',
          ok ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40' : 'bg-rose-500/20 text-rose-300 ring-rose-500/40',
        )}
      >
        {ok ? '✓' : '✕'}
      </div>
      <span className="text-[9px] text-text-muted uppercase tracking-[0.15em]">{label}</span>
    </div>
  );
}
function PipelineLine({ ok }: { ok: boolean }) {
  return <div className={cn('flex-1 h-px mb-4', ok ? 'bg-emerald-400/40' : 'bg-rose-400/40')} />;
}

// ─── Trust bar ───────────────────────────────────────────────────────
function TrustBar() {
  return (
    <section className="relative z-10 border-y border-bg-ring/60 bg-bg-elevated/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat headline="<200 ms" label="Validation latency" sub="Card → driver → vehicle → sub" />
        <Stat headline="100%" label="Auditability" sub="Every tap, granted or denied" />
        <Stat headline="∞" label="Audit retention" sub="Append-only event log" />
        <Stat headline="2-way" label="Theme" sub="Light + dark, your call" />
      </div>
    </section>
  );
}

function Stat({ headline, label, sub }: { headline: string; label: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      className="text-center md:text-left"
    >
      <div className="font-display text-3xl md:text-4xl tabular bg-gradient-to-r from-accent-cyan to-accent-violet bg-clip-text text-transparent">
        {headline}
      </div>
      <div className="text-sm mt-1">{label}</div>
      <div className="text-xs text-text-muted mt-0.5">{sub}</div>
    </motion.div>
  );
}

// ─── Features (6-up) ─────────────────────────────────────────────────
function Features() {
  const items = [
    {
      icon: <CardIcon />,
      title: 'Card-grade access',
      body: 'Six-state card lifecycle: in-stock, active, suspended, lost, blacklisted, retired. Replace, transfer, revoke with one click. Auto-sequential IDs (PSC-001, PSC-002…).',
    },
    {
      icon: <ShieldIcon />,
      title: 'Reader-authenticated gates',
      body: 'Each RFID reader presents a per-gate bearer token. Rotate it in one click if hardware is lost or compromised; old readers stop working instantly.',
    },
    {
      icon: <LedgerIcon />,
      title: 'Tap-level audit',
      body: 'Every tap — granted or denied — recorded with card, driver, vehicle, plate, gate, reason, IP, and timestamp. Disputes resolve from the ledger, not memory.',
    },
    {
      icon: <WhatsAppIcon />,
      title: 'WhatsApp reminders',
      body: 'Renewal cadence configurable per day (default T-3, T-1). Auto-sent on subscription create + each milestone. Twilio integration, dry-run mode for dev.',
    },
    {
      icon: <BillingIcon />,
      title: 'Subscription engine',
      body: 'Monthly subscriptions, grace period, lapsed state, bulk renew, plan catalog, payment ref capture, CSV exports.',
    },
    {
      icon: <PortalIcon />,
      title: 'Driver self-service',
      body: 'Drivers log in with their vehicle plate, see their subscription + tap history, change their password. Force-change on first login, password policy enforced.',
    },
  ];
  return (
    <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
      <SectionHeading
        eyebrow="Features"
        title="Built for parking operators who run real sites"
        body="Every workflow your reception and operations teams already do — codified, audited, and 2 clicks from anywhere."
      />
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: i * 0.05 }}
            className="group panel p-6 hover:ring-cyan-500/40 transition-all"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-accent-cyan/20 to-accent-violet/20 ring-1 ring-cyan-500/30 mb-4">
              {it.icon}
            </div>
            <h3 className="font-display text-lg">{it.title}</h3>
            <p className="text-text-secondary text-sm mt-2 leading-relaxed">{it.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── How it works ────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n: 1, title: 'Driver taps card', body: 'RFID/NFC card touched to the gate reader.' },
    { n: 2, title: 'Reader posts UID', body: 'Reader auths with its per-gate bearer token over HTTPS.' },
    { n: 3, title: 'Pipeline validates', body: 'Card status → driver → vehicle → subscription → gate.' },
    { n: 4, title: 'Gate opens, audit logged', body: 'OPEN_GATE relay fired; event broadcast to all admin dashboards.' },
  ];
  return (
    <section id="how" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
      <SectionHeading
        eyebrow="How it works"
        title="One tap. Four checks. Sub-200ms."
        body="The whole pipeline runs server-side in NestJS. Cron jobs maintain subscription state in the background; WebSocket broadcasts every tap live to every connected monitor + admin dashboard."
      />
      <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {/* Connecting line behind the cards on md+ */}
        <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-accent-cyan/30 via-accent-violet/30 to-accent-cyan/30" />
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: i * 0.08 }}
            className="relative panel p-5"
          >
            <div className="relative z-10 grid h-12 w-12 mx-auto place-items-center rounded-full bg-gradient-to-br from-accent-cyan to-accent-violet text-black/80 font-display text-lg ring-4 ring-bg-base">
              {s.n}
            </div>
            <h3 className="font-display text-base mt-4 text-center">{s.title}</h3>
            <p className="text-text-secondary text-xs mt-2 text-center leading-relaxed">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Architecture / stack diagram ────────────────────────────────────
function Stack() {
  return (
    <section id="stack" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
      <SectionHeading
        eyebrow="Architecture"
        title="The stack that runs the gate"
        body="Designed for one factory or a national fleet. SQLite for laptop demos, Postgres for production. WhatsApp via Twilio when you're ready to go live; dry-run otherwise."
      />

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
        {/* Left: stack list */}
        <div className="space-y-3">
          <StackRow label="Backend"    items={['NestJS 10', 'Prisma 5', 'Socket.IO']} />
          <StackRow label="Database"   items={['PostgreSQL', 'or SQLite']} />
          <StackRow label="Frontend"   items={['Next.js 14', 'Tailwind', 'Framer Motion']} />
          <StackRow label="Messaging"  items={['Twilio WhatsApp', 'dry-run dev mode']} />
          <StackRow label="Hardware"   items={['RFID readers (any 13.56 MHz / 125 kHz)', 'ESP32 relay']} />
          <StackRow label="Deployment" items={['Docker Compose', 'or bare Node']} />
        </div>

        {/* Right: visual flow */}
        <div className="panel p-7">
          <div className="text-[10px] tracking-[0.3em] uppercase text-text-muted mb-4">Request path</div>
          <div className="space-y-2 text-sm">
            <FlowRow from="RFID Reader" to="NestJS API" arrow="POST /card-access/tap" />
            <FlowRow from="NestJS API" to="Postgres" arrow="card + driver + sub lookups" />
            <FlowRow from="NestJS API" to="ESP32 Relay" arrow="OPEN_GATE command" />
            <FlowRow from="NestJS API" to="Twilio" arrow="WhatsApp on milestones" />
            <FlowRow from="NestJS API" to="WebSocket" arrow="broadcast to all dashboards" />
          </div>
        </div>
      </div>
    </section>
  );
}

function StackRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className="text-[10px] text-text-muted tracking-[0.2em] uppercase w-24 shrink-0">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className="rounded-md bg-bg-elevated ring-1 ring-bg-ring px-2 py-1 text-xs font-mono">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function FlowRow({ from, to, arrow }: { from: string; to: string; arrow: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-mono text-text-primary truncate">{from}</span>
      <span className="text-text-muted">→</span>
      <span className="font-mono text-accent-cyan whitespace-nowrap">{to}</span>
      <span className="text-text-muted text-[10px] truncate ml-auto">{arrow}</span>
    </div>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────
function FinalCta() {
  return (
    <section className="relative z-10 max-w-5xl mx-auto px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        className="panel-strong overflow-hidden relative p-10 md:p-14 text-center"
      >
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent-cyan/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-violet/20 blur-3xl" />
        <div className="relative">
          <h2 className="font-display text-3xl md:text-5xl tracking-tight">
            Walk in. Onboard a driver.
            <br />
            <span className="bg-gradient-to-r from-accent-cyan to-accent-violet bg-clip-text text-transparent">
              First tap inside 90 seconds.
            </span>
          </h2>
          <p className="text-text-secondary text-base md:text-lg mt-6 max-w-2xl mx-auto">
            Demo accounts seeded. Five subscription plans pre-configured. WhatsApp in dry-run
            mode out of the box. Plug in Twilio when you're ready to deliver real messages.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              href="/admin/dashboard"
              className="rounded-xl bg-gradient-to-r from-accent-cyan to-accent-violet px-6 py-3 font-medium text-black/90"
            >
              Open command center
            </Link>
            <Link
              href="/admin/onboard"
              className="rounded-xl bg-bg-elevated ring-1 ring-bg-ring px-6 py-3 text-text-primary hover:bg-bg-panel"
            >
              Onboard a driver →
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="relative z-10 border-t border-bg-ring/60 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 grid place-items-center rounded-lg bg-bg-elevated ring-1 ring-cyan-500/30 font-display">
              P
            </div>
            <div>
              <div className="font-display text-sm">ParkSphere</div>
              <div className="text-[10px] text-text-muted tracking-[0.2em] uppercase">Enterprise</div>
            </div>
          </div>
          <p className="text-text-secondary text-sm mt-4 max-w-xs">
            Smart vehicle access for factories, warehouses, and logistics hubs. Built for the people who run the gate.
          </p>
        </div>
        <FooterCol heading="Operations" links={[
          { label: 'Command Center', href: '/admin/dashboard' },
          { label: 'Tap History', href: '/admin/tap-history' },
          { label: 'Gates', href: '/admin/gates' },
          { label: 'Reminders', href: '/admin/reminders' },
        ]} />
        <FooterCol heading="Customers" links={[
          { label: 'Onboard driver', href: '/admin/onboard' },
          { label: 'Drivers', href: '/admin/drivers' },
          { label: 'Cards', href: '/admin/cards' },
          { label: 'Subscriptions', href: '/admin/subscriptions' },
        ]} />
        <FooterCol heading="Compliance" links={[
          { label: 'Reports', href: '/admin/reports' },
          { label: 'Audit Logs', href: '/admin/audit' },
          { label: 'Driver portal', href: '/driver/login' },
          { label: 'Live monitor', href: '/gate/GATE-A-ENTRY/monitor' },
        ]} />
      </div>
      <div className="border-t border-bg-ring/60">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-text-muted">
          <div suppressHydrationWarning>© {new Date().getFullYear()} ParkSphere Enterprise. Built for operators, not slideware.</div>
          <div className="font-mono">v0.2 · build dev</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ heading, links }: { heading: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-text-muted mb-3">{heading}</div>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-text-secondary hover:text-text-primary">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-xs text-text-secondary tracking-[0.3em] uppercase">{eyebrow}</div>
      <h2 className="font-display text-3xl md:text-4xl tracking-tight mt-2">{title}</h2>
      <p className="text-text-secondary mt-3 leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Icons (inline SVG, theme-aware via currentColor) ─────────────────
const ico = 'w-5 h-5 text-accent-cyan';
function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ico}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" strokeLinecap="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ico}>
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LedgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ico}>
      <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z" />
      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ico}>
      <path d="M3 21l2.3-5.4A8 8 0 1 1 8.6 18.7L3 21z" strokeLinejoin="round" />
      <path d="M9 11c.5 1.5 1.5 2.5 3 3l1-1.5 2.5 1c-.5 1.5-2 2-3 2-2 0-4-2-4.5-4l1-1.5z" strokeLinejoin="round" />
    </svg>
  );
}
function BillingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ico}>
      <path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2V4z" strokeLinejoin="round" />
      <path d="M9 9h6M9 12h6M9 15h3" strokeLinecap="round" />
    </svg>
  );
}
function PortalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ico}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
    </svg>
  );
}
