// Mock API for demo mode (no backend). When NEXT_PUBLIC_DEMO_MODE=true,
// api.ts routes requests here instead of hitting the network.
//
// We keep the response shapes byte-for-byte identical to the real NestJS API
// so every page renders without any per-component changes.

import {
  DEMO_DRIVERS, DEMO_GATES, DEMO_PLANS, DEMO_CARDS, DEMO_SUBS,
  DEMO_RECENT_TAPS, DEMO_DAILY_TAPS, DEMO_AUDIT, DEMO_REMINDERS,
} from './fixtures';

export interface MockRequest {
  path: string;          // e.g. "/drivers?search=raju"
  method: string;
  body?: unknown;
}

const DEMO_TOKEN = 'demo-token-xxxxxx';
const DEMO_USER = {
  id: 'demo-admin',
  email: 'admin@parksphere.local',
  role: 'ADMIN',
  fullName: 'ParkSphere Admin',
  driverPublicId: null,
  forceChangePassword: false,
};

const DEMO_DRIVER_USER = (publicId: string, plate: string) => ({
  id: 'demo-driver-user',
  email: 'driver@parksphere.local',
  role: 'DRIVER',
  fullName: 'Raju Kumaran',
  driverPublicId: publicId,
  forceChangePassword: false,
  plate,
});

// Routes a request to its mock handler. Returns whatever the page expects —
// arrays, paginated objects, single records. The "demo answer" for write
// endpoints (POST/PUT) is usually "ok" and a return-shaped object.
export function handleMock(req: MockRequest): unknown {
  const url = req.path.split('?')[0];
  const params = new URLSearchParams((req.path.split('?')[1] ?? ''));

  // ─── Auth ─────────────────────────────────────────────────────────
  if (url === '/auth/login' && req.method === 'POST') {
    return { token: DEMO_TOKEN, user: DEMO_USER };
  }
  if (url === '/auth/login-driver' && req.method === 'POST') {
    const b = (req.body as { plate?: string }) ?? {};
    return { token: DEMO_TOKEN, user: DEMO_DRIVER_USER('RAJU7690QW', (b.plate ?? 'WXY1234').toUpperCase()) };
  }
  if (url === '/auth/change-password' && req.method === 'POST') {
    return { ok: true };
  }
  if (url === '/auth/me') {
    return { ...DEMO_USER, driver: null };
  }

  // ─── Stats / summaries ────────────────────────────────────────────
  if (url === '/health') return { ok: true, checks: { api: { ok: true } } };
  if (url === '/settings') return { tapDebounceMs: 1500, reminderSchedule: { daysBeforeExpiry: [3, 1], includeGrace: true, includeLapsed: true, hourOfDay: 9 } };
  if (url === '/subscriptions/stats') return { active: 3, expired: 1, expiringSoon: 1, pending: 0, blacklisted: 0 };
  if (url === '/cards/stats') return { total: 6, active: 4, inStock: 1, lost: 1, blacklisted: 0 };
  if (url === '/tap-events/summary') return { since: DEMO_DAILY_TAPS[13].date, granted: 387, denied: 23, byResult: { GRANTED: 387, DENIED_SUBSCRIPTION_EXPIRED: 8, DENIED_CARD_UNKNOWN: 11, DENIED_CARD_LOST: 4 } };
  if (url === '/reminders/stats') return { byStatus: { SCHEDULED: 4, DRY_RUN: 5, SENT: 3 } };
  if (url === '/reminders/config') return { whatsapp: { mode: 'dry', live: false, instructions: 'WhatsApp is in DRY-RUN mode for this preview. The full system supports live WhatsApp via Twilio.' }, templates: [] };

  // ─── Lists (some paginated, some plain arrays) ────────────────────
  if (url === '/drivers') {
    const search = (params.get('search') ?? '').toLowerCase();
    const items = search
      ? DEMO_DRIVERS.filter((d) =>
          [d.fullName, d.publicId, d.user.email, d.phone, ...d.vehicles.map((v) => v.plate)]
            .join(' ').toLowerCase().includes(search))
      : DEMO_DRIVERS;
    return { items, total: items.length, skip: 0, take: 25 };
  }
  if (url.startsWith('/drivers/by-email/')) {
    const email = decodeURIComponent(url.replace('/drivers/by-email/', ''));
    const d = DEMO_DRIVERS.find((x) => x.user.email === email);
    return d ? { id: d.id, publicId: d.publicId, fullName: d.fullName, email: d.user.email, phone: d.phone, company: d.company, vehicles: d.vehicles, currentSubscription: d.subscriptions[0] } : null;
  }
  if (url.match(/^\/drivers\/[^/]+$/)) {
    const id = url.split('/')[2];
    const d = DEMO_DRIVERS.find((x) => x.id === id) ?? DEMO_DRIVERS[0];
    return {
      ...d,
      user: { id: 'u-' + d.id, email: d.user.email, role: 'DRIVER', fullName: d.fullName, createdAt: d.createdAt },
      forceChangePassword: false, lockedAt: null, lockedReason: null,
      lastLoginAt: minutesAgoIso(45), passwordChangedAt: minutesAgoIso(60 * 24 * 7),
      cardAssignments: [],
      recentTaps: DEMO_RECENT_TAPS.filter((t) => t.driver?.publicId === d.publicId),
    };
  }
  if (url === '/vehicles') {
    const items = DEMO_DRIVERS.flatMap((d) =>
      d.vehicles.map((v) => ({ ...v, active: true, createdAt: d.createdAt, driverId: d.id, driver: { id: d.id, publicId: d.publicId, fullName: d.fullName } })));
    return { items, total: items.length, skip: 0, take: 25 };
  }
  if (url === '/subscriptions') return { items: DEMO_SUBS, total: DEMO_SUBS.length, skip: 0, take: 25 };
  if (url === '/cards') return DEMO_CARDS;
  if (url === '/gates') return DEMO_GATES;
  if (url.startsWith('/gates/public/')) {
    const code = decodeURIComponent(url.replace('/gates/public/', ''));
    const g = DEMO_GATES.find((x) => x.code === code) ?? DEMO_GATES[0];
    const { accessToken: _, ...pub } = g;
    return pub;
  }
  if (url === '/plans') return DEMO_PLANS;
  if (url === '/audit') return { items: DEMO_AUDIT, total: DEMO_AUDIT.length, skip: 0, take: 50 };
  if (url === '/audit/stats') return { AUTH: 32, TAP: 410, CARD: 11, SUBSCRIPTION: 7, ADMIN_ACTION: 4, SETTINGS: 2 };
  if (url === '/tap-events') return { items: DEMO_RECENT_TAPS, total: DEMO_RECENT_TAPS.length, skip: 0, take: 50 };
  if (url === '/reminders') return { items: DEMO_REMINDERS, total: DEMO_REMINDERS.length, skip: 0, take: 50 };

  if (url === '/reports/summary') {
    return {
      revenue: { monthStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(), monthEnd: '', count: 14, totalCents: 386000, activeCents: 320000 },
      daily: DEMO_DAILY_TAPS,
      expiring: DEMO_SUBS.slice(0, 2),
      denials: [
        { result: 'DENIED_CARD_UNKNOWN', count: 11 },
        { result: 'DENIED_SUBSCRIPTION_EXPIRED', count: 8 },
        { result: 'DENIED_CARD_LOST', count: 4 },
      ],
    };
  }

  // ─── Mutations — accept everything, return realistic shapes ───────
  if (req.method === 'POST' && url === '/drivers') {
    const b = req.body as { fullName: string; vehiclePlate: string };
    return {
      id: 'demo-new-' + Date.now(),
      publicId: (b.fullName.replace(/[^A-Z]/gi, '').slice(0, 4).toUpperCase().padEnd(4, 'X') + '0001AB'),
      tempPassword: 'PARK-DEMO1AB',
      portalUrl: typeof window !== 'undefined' ? `${window.location.origin}/driver/login` : '',
    };
  }
  if (req.method === 'POST' && (url === '/subscriptions' || url === '/cards' || url === '/vehicles')) {
    return { id: 'demo-' + Date.now(), ok: true };
  }
  if (req.method === 'POST' && url.includes('/reset-password')) {
    return { tempPassword: 'PARK-RESET2X', portalUrl: typeof window !== 'undefined' ? `${window.location.origin}/driver/login` : '' };
  }
  if (req.method === 'POST') return { ok: true };
  if (req.method === 'PUT') return { ok: true };
  if (req.method === 'DELETE') return { ok: true };

  // Default — empty paginated response so list pages render an empty state
  return { items: [], total: 0, skip: 0, take: 25 };
}

function minutesAgoIso(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

// Fake socket.io — periodically emits a simulated tap so the dashboard's
// live feed has motion in demo mode. Matches the broadcastCardTap payload.
export function startMockSocketStream(onTap: (tap: unknown) => void): () => void {
  const samples = [
    { driver: 'RAJU7690QW', plate: 'WXY1234', card: 'PSC-001', granted: true,  result: 'GRANTED', reason: null },
    { driver: 'AHMA2210ZK', plate: 'WTC7788', card: 'PSC-002', granted: true,  result: 'GRANTED', reason: null },
    { driver: 'SITI4451MN', plate: 'VAH9921', card: 'PSC-003', granted: true,  result: 'GRANTED', reason: null },
    { driver: 'TANW0090PQ', plate: 'JPK3300', card: 'PSC-004', granted: false, result: 'DENIED_SUBSCRIPTION_EXPIRED', reason: 'Subscription expired' },
    { driver: null, plate: null, card: 'DEADBEEF', granted: false, result: 'DENIED_CARD_UNKNOWN', reason: 'Card not registered' },
  ];
  let i = 0;
  const tick = () => {
    const s = samples[i % samples.length];
    i++;
    onTap({
      id: 'mock-' + Date.now(),
      at: new Date().toISOString(),
      gateId: 'g1',
      gateCode: 'GATE-A-ENTRY',
      cardUid: s.card,
      result: s.result,
      reason: s.reason,
      driverPublicId: s.driver,
      plate: s.plate,
      granted: s.granted,
    });
  };
  // First tap after 5s, then every 8–12s with slight jitter.
  const initial = setTimeout(tick, 5000);
  const interval = setInterval(tick, 9500);
  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
}
