import Link from 'next/link';
import { ThemeToggle } from '@/components/ui';
import LandingClient from './landing-client';

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Layered animated background — radial spots from the theme + a faint grid */}
      <div className="absolute inset-0 grid-bg pointer-events-none" aria-hidden />

      {/* Sticky nav */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-bg-base/60 border-b border-bg-ring/60">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 grid place-items-center rounded-lg bg-bg-elevated ring-1 ring-cyan-500/30 font-display">
              P
            </div>
            <div className="leading-tight">
              <div className="font-display text-sm">ParkSphere</div>
              <div className="text-[10px] text-text-muted tracking-[0.2em] uppercase">Enterprise</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-text-secondary hover:text-text-primary">Features</a>
            <a href="#how" className="text-text-secondary hover:text-text-primary">How it works</a>
            <a href="#stack" className="text-text-secondary hover:text-text-primary">Architecture</a>
            <Link href="/gate/GATE-A-ENTRY/monitor" className="text-text-secondary hover:text-text-primary">Live monitor</Link>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeToggle compact />
            </div>
            <Link
              href="/driver/login"
              className="hidden sm:inline-block rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-3 py-1.5 text-xs text-text-primary hover:bg-bg-panel"
            >
              Driver
            </Link>
            <Link
              href="/admin/login"
              className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-4 py-1.5 text-xs font-medium text-black/90"
            >
              Operations →
            </Link>
          </div>
        </div>
      </header>

      <LandingClient />
    </main>
  );
}
