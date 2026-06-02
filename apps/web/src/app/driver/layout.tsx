'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, auth, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ui';

type Me = {
  id: string;
  email: string;
  role: string;
  fullName: string;
  driver: {
    id: string;
    publicId: string;
    forceChangePassword: boolean;
    lockedAt: string | null;
  } | null;
};

const NAV = [
  { href: '/driver', label: 'Dashboard' },
  { href: '/driver/profile', label: 'Profile' },
  { href: '/driver/security', label: 'Change password' },
];

// Driver portal layout. Two responsibilities:
//   1. Redirect rules — if not logged in → /driver/login.
//      If forceChangePassword=true → /driver/security (cannot leave).
//   2. Render shared sidebar + sign-out.
export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Public pages — don't fetch /auth/me.
  const isPublic = pathname === '/driver/login';

  useEffect(() => {
    if (isPublic) {
      setAuthChecked(true);
      return;
    }
    const token = auth.get();
    if (!token) {
      router.replace('/driver/login');
      return;
    }
    api<Me>('/auth/me')
      .then((m) => {
        if (m.role !== 'DRIVER') {
          auth.clear();
          router.replace('/driver/login');
          return;
        }
        setMe(m);
        if (m.driver?.forceChangePassword && pathname !== '/driver/security') {
          router.replace('/driver/security');
        }
      })
      .catch((e) => {
        // 401 / network — treat as logged out.
        auth.clear();
        router.replace('/driver/login');
      })
      .finally(() => setAuthChecked(true));
  }, [pathname, isPublic, router]);

  if (isPublic) return <>{children}</>;
  if (!authChecked) return null;
  if (!me) return null;

  return (
    <div className="min-h-screen">
      <aside className="app-sidebar fixed top-0 bottom-0 left-0 w-64 p-5 flex flex-col overflow-y-auto">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 grid place-items-center rounded-lg bg-bg-elevated ring-1 ring-cyan-500/30 font-display">
            P
          </div>
          <div>
            <div className="font-display text-sm">ParkSphere</div>
            <div className="text-[10px] text-text-muted tracking-[0.2em] uppercase">Driver Portal</div>
          </div>
        </Link>

        <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3 mb-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Signed in</div>
          <div className="font-display text-sm mt-1 truncate">{me.fullName}</div>
          <div className="text-[11px] text-text-muted font-mono mt-0.5 truncate">{me.driver?.publicId ?? me.email}</div>
        </div>

        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href;
            // Disable nav while force-change is pending
            const disabled = me.driver?.forceChangePassword && item.href !== '/driver/security';
            return (
              <Link
                key={item.href}
                href={disabled ? '/driver/security' : item.href}
                className={cn(
                  'rounded-lg px-3 py-2',
                  active
                    ? 'bg-bg-elevated text-text-primary ring-1 ring-cyan-500/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/70',
                  disabled && 'opacity-50 pointer-events-none',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 space-y-2">
          <ThemeToggle />
          <button
            onClick={() => {
              auth.clear();
              router.replace('/driver/login');
            }}
            className="text-xs text-text-muted hover:text-text-primary text-left w-full"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="ml-64 px-8 py-8 max-w-[1200px]">{children}</main>
    </div>
  );
}
