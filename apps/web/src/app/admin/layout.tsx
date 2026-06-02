'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ui';

type Item = { href: string; label: string };
type Section = { label: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    label: 'Operations',
    items: [
      { href: '/admin/dashboard', label: 'Command Center' },
      { href: '/admin/tap-history', label: 'Tap History' },
      { href: '/admin/reminders', label: 'Reminders' },
      { href: '/admin/gates', label: 'Gates' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/admin/onboard', label: '+ Onboard driver' },
      { href: '/admin/drivers', label: 'Drivers' },
      { href: '/admin/vehicles', label: 'Vehicles' },
      { href: '/admin/cards', label: 'Cards' },
      { href: '/admin/subscriptions', label: 'Subscriptions' },
      { href: '/admin/plans', label: 'Plans' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { href: '/admin/reports', label: 'Reports' },
      { href: '/admin/audit', label: 'Audit Logs' },
    ],
  },
  {
    label: 'System',
    items: [{ href: '/admin/settings', label: 'Settings' }],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = !!auth.get();
    setAuthed(ok);
    if (!ok && pathname !== '/admin/login') router.replace('/admin/login');
  }, [pathname, router]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (authed === null) return null;
  if (!authed) return null;

  return (
    <div className="min-h-screen">
      <aside className="app-sidebar fixed top-0 bottom-0 left-0 w-64 p-5 flex flex-col overflow-y-auto">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 grid place-items-center rounded-lg bg-bg-elevated ring-1 ring-cyan-500/30 font-display">
            P
          </div>
          <div>
            <div className="font-display text-sm">ParkSphere</div>
            <div className="text-[10px] text-text-muted tracking-[0.2em] uppercase">Enterprise</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-5 text-sm">
          {SECTIONS.map((sec) => (
            <div key={sec.label}>
              <div className="px-3 mb-2 text-[10px] tracking-[0.2em] uppercase text-text-muted">
                {sec.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {sec.items.map((item) => {
                  const active =
                    pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'rounded-lg px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated/70 flex items-center justify-between',
                        active && 'bg-bg-elevated text-text-primary ring-1 ring-cyan-500/20',
                      )}
                    >
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6 space-y-2">
          <ThemeToggle />
          <button
            onClick={() => {
              auth.clear();
              router.replace('/admin/login');
            }}
            className="text-xs text-text-muted hover:text-text-primary text-left w-full"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="ml-64 px-8 py-8 max-w-[1400px]">{children}</main>
    </div>
  );
}
