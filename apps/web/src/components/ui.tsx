'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/theme';

// Preview-mode banner — shows at the top of every page when the app is built
// with NEXT_PUBLIC_DEMO_MODE=true (Vercel-only demo, no backend wired). All
// data on screen comes from in-memory fixtures.
export function PreviewBanner() {
  // Read at runtime so the banner is present on any page that mounts.
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  if (!demo) return null;
  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-500/90 via-amber-400/90 to-amber-500/90 text-amber-950 text-center text-xs py-1.5 px-4 font-medium tracking-wide">
      Preview build — sample data, no live backend. Full system with real RFID, WhatsApp, Postgres available on approval.
    </div>
  );
}

// Theme toggle pill. Sits in the sidebar of admin / driver portals.
// Shows the OTHER theme as the next action — clicking switches to it.
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg ring-1 transition',
        'bg-bg-elevated ring-bg-ring hover:bg-bg-panel',
        compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm w-full justify-start',
      )}
    >
      <span className="grid place-items-center w-5 h-5">
        {/* Sun if currently dark (action = go light); moon if currently light. */}
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </span>
      {!compact && (
        <span className="text-text-secondary">
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </span>
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 text-amber-400">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 text-text-secondary">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Skeleton — animated placeholder for loading states. Use to reserve layout
// so pages don't pop in jarringly.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-bg-elevated/80',
        className,
      )}
    />
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-3 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-32' : 'flex-1')} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="panel-strong p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  );
}

// EmptyState — for tables/lists with no data. Always include an action so the
// user knows what to do next.
export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="panel-strong p-10 text-center">
      {icon && <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-bg-elevated text-text-secondary">{icon}</div>}
      <div className="font-display text-lg">{title}</div>
      {body && <div className="text-sm text-text-muted mt-2 max-w-md mx-auto">{body}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ErrorBox — consistent inline error display. Use when an action fails.
export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 text-rose-200 text-sm px-3 py-2">
      {message}
    </div>
  );
}

// Pagination — for any list endpoint that returns { items, total, skip, take }.
export function Paginator({
  total,
  skip,
  take,
  onChange,
}: {
  total: number;
  skip: number;
  take: number;
  onChange: (newSkip: number) => void;
}) {
  if (total <= take) return null;
  const page = Math.floor(skip / take) + 1;
  const pages = Math.max(1, Math.ceil(total / take));
  return (
    <div className="flex items-center justify-between text-xs text-text-secondary mt-3">
      <div>
        Showing {skip + 1}–{Math.min(skip + take, total)} of {total}
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onChange(Math.max(0, skip - take))}
          className="rounded bg-bg-elevated ring-1 ring-bg-ring px-2 py-1 disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span className="font-mono">
          {page} / {pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => onChange(skip + take)}
          className="rounded bg-bg-elevated ring-1 ring-bg-ring px-2 py-1 disabled:opacity-40"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

// PageHeader — shared header for every admin page.
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        {eyebrow && (
          <div className="text-text-secondary text-xs tracking-[0.3em] uppercase">{eyebrow}</div>
        )}
        <h1 className="font-display text-4xl mt-1 tracking-tight">{title}</h1>
        {description && (
          <p className="text-text-muted text-sm mt-2 max-w-2xl">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

// StatTile — small KPI tile used across pages.
export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'cyan' | 'violet' | 'amber' | 'rose' | 'emerald';
}) {
  return (
    <div className="panel p-4 relative overflow-hidden">
      {tone && (
        <div
          className={cn(
            'absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl opacity-30',
            tone === 'cyan' && 'bg-accent-cyan',
            tone === 'violet' && 'bg-accent-violet',
            tone === 'amber' && 'bg-accent-amber',
            tone === 'rose' && 'bg-accent-rose',
            tone === 'emerald' && 'bg-emerald-400',
          )}
        />
      )}
      <div className="relative">
        <div className="text-text-secondary text-[10px] tracking-[0.2em] uppercase">{label}</div>
        <div className="font-display tabular text-3xl mt-1 leading-none">{value}</div>
        {sub && <div className="text-xs text-text-muted mt-2">{sub}</div>}
      </div>
    </div>
  );
}

// ConfirmButton — primitive that asks for confirmation before firing onClick.
export function ConfirmButton({
  prompt,
  onConfirm,
  children,
  className,
  disabled,
}: {
  prompt: string;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  async function handle() {
    if (window.confirm(prompt)) await onConfirm();
  }
  return (
    <button onClick={handle} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
