// Sample data used in demo mode (no backend). Mirrors the shape of the real
// API responses so every page renders exactly as it would with the real
// backend. Numbers + IDs are stable so the demo looks consistent on reload.

export const DEMO_DRIVERS = [
  {
    id: 'demo-raju',
    publicId: 'RAJU7690QW',
    fullName: 'Raju Kumaran',
    phone: '+60123456001',
    company: 'Sentral Logistics',
    createdAt: '2026-05-15T08:00:00.000Z',
    user: { email: 'raju@parksphere.local', role: 'DRIVER' },
    vehicles: [{ id: 'v1', plate: 'WXY1234', type: 'LORRY' }],
    subscriptions: [{ id: 's1', planName: 'Lorry Monthly', status: 'ACTIVE', expiresAt: '2026-07-17T00:00:00.000Z' }],
    cards: [{ id: 'c1', uid: 'PSC-001', status: 'ACTIVE' }],
  },
  {
    id: 'demo-ahmad',
    publicId: 'AHMA2210ZK',
    fullName: 'Ahmad Faizal',
    phone: '+60123456002',
    company: null,
    createdAt: '2026-05-20T08:00:00.000Z',
    user: { email: 'ahmad@parksphere.local', role: 'DRIVER' },
    vehicles: [{ id: 'v2', plate: 'WTC7788', type: 'CAR' }],
    subscriptions: [{ id: 's2', planName: 'Staff Monthly', status: 'ACTIVE', expiresAt: '2026-06-08T00:00:00.000Z' }],
    cards: [{ id: 'c2', uid: 'PSC-002', status: 'ACTIVE' }],
  },
  {
    id: 'demo-siti',
    publicId: 'SITI4451MN',
    fullName: 'Siti Nurhaliza',
    phone: '+60123456003',
    company: 'Vendor Co.',
    createdAt: '2026-04-10T08:00:00.000Z',
    user: { email: 'siti@parksphere.local', role: 'DRIVER' },
    vehicles: [{ id: 'v3', plate: 'VAH9921', type: 'VAN' }],
    subscriptions: [{ id: 's3', planName: 'Contractor Monthly', status: 'ACTIVE', expiresAt: '2026-08-02T00:00:00.000Z' }],
    cards: [{ id: 'c3', uid: 'PSC-003', status: 'ACTIVE' }],
  },
  {
    id: 'demo-tan',
    publicId: 'TANW0090PQ',
    fullName: 'Tan Wei Ming',
    phone: '+60123456004',
    company: null,
    createdAt: '2026-04-01T08:00:00.000Z',
    user: { email: 'expired@parksphere.local', role: 'DRIVER' },
    vehicles: [{ id: 'v4', plate: 'JPK3300', type: 'CAR' }],
    subscriptions: [{ id: 's4', planName: 'Staff Monthly', status: 'EXPIRED', expiresAt: '2026-05-30T00:00:00.000Z' }],
    cards: [{ id: 'c4', uid: 'PSC-004', status: 'ACTIVE' }],
  },
];

export const DEMO_GATES = [
  { id: 'g1', code: 'GATE-A-ENTRY', name: 'North Entry — Zone A', direction: 'ENTRY', status: 'ONLINE', zone: 'Zone A', capacity: 250, occupancy: 124, accessToken: 'demo-token-entry-xxxx' },
  { id: 'g2', code: 'GATE-A-EXIT',  name: 'North Exit — Zone A',  direction: 'EXIT',  status: 'ONLINE', zone: 'Zone A', capacity: 250, occupancy: 124, accessToken: 'demo-token-exit-xxxx' },
];

export const DEMO_PLANS = [
  { id: 'p1', name: 'Staff Monthly',      priceCents: 12000, durationDays: 30, description: 'Standard staff parking access', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'p2', name: 'Lorry Monthly',      priceCents: 35000, durationDays: 30, description: 'Heavy vehicle / lorry access', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'p3', name: 'Contractor Monthly', priceCents: 25000, durationDays: 30, description: 'Vendor and contractor pass',   active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'p4', name: 'VIP Monthly',        priceCents: 50000, durationDays: 30, description: 'Premium reserved zone access', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'p5', name: 'Annual Staff',       priceCents: 120000, durationDays: 365, description: 'Discounted yearly staff plan', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
];

export const DEMO_CARDS = [
  { id: 'c1', uid: 'PSC-001', label: 'Driver Card #001', status: 'ACTIVE',      driverId: 'demo-raju',  driver: { publicId: 'RAJU7690QW', fullName: 'Raju Kumaran',   phone: '+60123456001' }, issuedAt: '2026-05-15T08:00:00.000Z', createdAt: '2026-05-15T08:00:00.000Z', expiresAt: null, notes: null, replaces: null, replacedBy: null },
  { id: 'c2', uid: 'PSC-002', label: 'Driver Card #002', status: 'ACTIVE',      driverId: 'demo-ahmad', driver: { publicId: 'AHMA2210ZK', fullName: 'Ahmad Faizal',   phone: '+60123456002' }, issuedAt: '2026-05-20T08:00:00.000Z', createdAt: '2026-05-20T08:00:00.000Z', expiresAt: null, notes: null, replaces: null, replacedBy: null },
  { id: 'c3', uid: 'PSC-003', label: 'Driver Card #003', status: 'ACTIVE',      driverId: 'demo-siti',  driver: { publicId: 'SITI4451MN', fullName: 'Siti Nurhaliza', phone: '+60123456003' }, issuedAt: '2026-04-10T08:00:00.000Z', createdAt: '2026-04-10T08:00:00.000Z', expiresAt: null, notes: null, replaces: null, replacedBy: null },
  { id: 'c4', uid: 'PSC-004', label: 'Driver Card #004', status: 'ACTIVE',      driverId: 'demo-tan',   driver: { publicId: 'TANW0090PQ', fullName: 'Tan Wei Ming',   phone: '+60123456004' }, issuedAt: '2026-04-01T08:00:00.000Z', createdAt: '2026-04-01T08:00:00.000Z', expiresAt: null, notes: null, replaces: null, replacedBy: null },
  { id: 'c5', uid: 'PSC-005', label: 'Spare #005',       status: 'IN_STOCK',    driverId: null, driver: null, issuedAt: null, createdAt: '2026-05-25T08:00:00.000Z', expiresAt: null, notes: null, replaces: null, replacedBy: null },
  { id: 'c6', uid: 'PSC-006', label: 'Reported lost',    status: 'LOST',        driverId: null, driver: null, issuedAt: null, createdAt: '2026-05-12T08:00:00.000Z', expiresAt: null, notes: null, replaces: null, replacedBy: null },
];

export const DEMO_SUBS = DEMO_DRIVERS.map((d, i) => ({
  id: `sub-${i}`,
  planName: d.subscriptions[0].planName,
  priceCents: i === 0 ? 35000 : i === 2 ? 25000 : 12000,
  status: d.subscriptions[0].status,
  startsAt: '2026-05-01T00:00:00.000Z',
  expiresAt: d.subscriptions[0].expiresAt,
  driver: { id: d.id, publicId: d.publicId, fullName: d.fullName, phone: d.phone },
}));

export const DEMO_RECENT_TAPS = [
  { id: 't1', createdAt: minutesAgo(2),  gateId: 'g1', gateCode: 'GATE-A-ENTRY', cardUid: 'PSC-001', result: 'GRANTED',                  reason: null,                                  driver: { publicId: 'RAJU7690QW', fullName: 'Raju Kumaran' },   vehicle: { plate: 'WXY1234', type: 'LORRY' }, card: { uid: 'PSC-001', label: 'Driver Card #001' }, gate: { code: 'GATE-A-ENTRY', name: 'North Entry — Zone A', direction: 'ENTRY' } },
  { id: 't2', createdAt: minutesAgo(8),  gateId: 'g1', gateCode: 'GATE-A-ENTRY', cardUid: 'PSC-002', result: 'GRANTED',                  reason: null,                                  driver: { publicId: 'AHMA2210ZK', fullName: 'Ahmad Faizal' },   vehicle: { plate: 'WTC7788', type: 'CAR' },   card: { uid: 'PSC-002', label: 'Driver Card #002' }, gate: { code: 'GATE-A-ENTRY', name: 'North Entry — Zone A', direction: 'ENTRY' } },
  { id: 't3', createdAt: minutesAgo(14), gateId: 'g2', gateCode: 'GATE-A-EXIT',  cardUid: 'PSC-001', result: 'GRANTED',                  reason: null,                                  driver: { publicId: 'RAJU7690QW', fullName: 'Raju Kumaran' },   vehicle: { plate: 'WXY1234', type: 'LORRY' }, card: { uid: 'PSC-001', label: 'Driver Card #001' }, gate: { code: 'GATE-A-EXIT',  name: 'North Exit — Zone A',  direction: 'EXIT'  } },
  { id: 't4', createdAt: minutesAgo(22), gateId: 'g1', gateCode: 'GATE-A-ENTRY', cardUid: 'PSC-004', result: 'DENIED_SUBSCRIPTION_EXPIRED', reason: 'Subscription expired',              driver: { publicId: 'TANW0090PQ', fullName: 'Tan Wei Ming' },   vehicle: { plate: 'JPK3300', type: 'CAR' },   card: { uid: 'PSC-004', label: 'Driver Card #004' }, gate: { code: 'GATE-A-ENTRY', name: 'North Entry — Zone A', direction: 'ENTRY' } },
  { id: 't5', createdAt: minutesAgo(31), gateId: 'g1', gateCode: 'GATE-A-ENTRY', cardUid: 'PSC-003', result: 'GRANTED',                  reason: null,                                  driver: { publicId: 'SITI4451MN', fullName: 'Siti Nurhaliza' }, vehicle: { plate: 'VAH9921', type: 'VAN' },   card: { uid: 'PSC-003', label: 'Driver Card #003' }, gate: { code: 'GATE-A-ENTRY', name: 'North Entry — Zone A', direction: 'ENTRY' } },
  { id: 't6', createdAt: minutesAgo(40), gateId: 'g1', gateCode: 'GATE-A-ENTRY', cardUid: 'DEADBEEF', result: 'DENIED_CARD_UNKNOWN',     reason: 'Card not found in system',           driver: null, vehicle: null, card: null,                                                                  gate: { code: 'GATE-A-ENTRY', name: 'North Entry — Zone A', direction: 'ENTRY' } },
];

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

// 14-day taps histogram — descending date order would feel wrong; we render
// it left-to-right oldest→newest. Stable counts so the bars look the same.
export const DEMO_DAILY_TAPS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000);
  // Slight variation; weekdays > weekends
  const dow = d.getDay();
  const base = dow === 0 || dow === 6 ? 12 : 38;
  const granted = base + ((i * 7) % 11);
  const denied = Math.max(1, Math.round(granted * 0.08));
  return { date: d.toISOString().slice(0, 10), granted, denied };
});

export const DEMO_AUDIT = Array.from({ length: 18 }, (_, i) => ({
  id: `a${i}`,
  category: ['AUTH','TAP','CARD','SUBSCRIPTION','ADMIN_ACTION','SETTINGS'][i % 6],
  actorId: 'demo-admin',
  actorRole: i % 4 === 0 ? 'DRIVER' : 'ADMIN',
  action: ['user.login','gate.opened','card.issued','subscription.renewed','driver.password_reset','settings.updated','gate.manual_open','card.assigned'][i % 8],
  targetType: 'Driver',
  targetId: `target-${i}`,
  metadata: { sample: true, index: i },
  ipAddress: '203.0.113.42',
  createdAt: minutesAgo(i * 17),
}));

export const DEMO_REMINDERS = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  driverId: DEMO_DRIVERS[i % DEMO_DRIVERS.length].id,
  subscriptionId: 's' + ((i % 4) + 1),
  kind: ['T_MINUS_3','T_MINUS_1','T_ZERO','GRACE_1','LAPSED','T_MINUS_3','T_MINUS_1'][i % 7],
  channel: 'WHATSAPP',
  status: i < 4 ? 'SCHEDULED' : i < 9 ? 'DRY_RUN' : 'SENT',
  scheduledFor: new Date(Date.now() + (i - 6) * 24 * 60 * 60 * 1000).toISOString(),
  sentAt: i >= 4 ? minutesAgo(i * 23) : null,
  deliveredAt: null,
  failedAt: null,
  attempts: 0,
  failReason: null,
  externalId: i >= 9 ? `SM${i}xxxxxxxxx` : null,
  renderedBody: 'Hi Raju, your Lorry Monthly subscription expires in 3 days. Please renew at reception.',
  recipientPhone: DEMO_DRIVERS[i % DEMO_DRIVERS.length].phone,
  driver: { publicId: DEMO_DRIVERS[i % DEMO_DRIVERS.length].publicId, fullName: DEMO_DRIVERS[i % DEMO_DRIVERS.length].fullName, phone: DEMO_DRIVERS[i % DEMO_DRIVERS.length].phone },
  subscription: { planName: 'Lorry Monthly', expiresAt: '2026-07-17T00:00:00.000Z' },
}));
