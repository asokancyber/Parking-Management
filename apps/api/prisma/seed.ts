import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  UserRole,
  GateDirection,
  GateStatus,
  SubscriptionStatus,
  CardStatus,
  CardAssignmentReason,
} from '../src/common/enums';

const prisma = new PrismaClient();

function token() {
  return randomBytes(24).toString('base64url');
}

async function main() {
  console.log('Seeding ParkSphere Enterprise demo data…');

  // ─── Plans (subscription presets) ──────────────────────────────────
  const planSeeds = [
    { name: 'Staff Monthly',      priceCents: 12000, durationDays: 30, description: 'Standard staff parking access' },
    { name: 'Lorry Monthly',      priceCents: 35000, durationDays: 30, description: 'Heavy vehicle / lorry access' },
    { name: 'Contractor Monthly', priceCents: 25000, durationDays: 30, description: 'Vendor and contractor pass' },
    { name: 'VIP Monthly',        priceCents: 50000, durationDays: 30, description: 'Premium reserved zone access' },
    { name: 'Annual Staff',       priceCents: 120000, durationDays: 365, description: 'Discounted yearly staff plan' },
  ];
  for (const p of planSeeds) {
    await prisma.plan.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }

  // ─── Admin operator ────────────────────────────────────────────────
  const adminPassword = await argon2.hash('parksphere-admin');
  await prisma.user.upsert({
    where: { email: 'admin@parksphere.local' },
    update: {},
    create: {
      email: 'admin@parksphere.local',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      fullName: 'ParkSphere Admin',
    },
  });

  // ─── Gates ─────────────────────────────────────────────────────────
  const gateA = await prisma.gate.upsert({
    where: { code: 'GATE-A-ENTRY' },
    update: {},
    create: {
      code: 'GATE-A-ENTRY',
      name: 'North Entry — Zone A',
      direction: GateDirection.ENTRY,
      status: GateStatus.ONLINE,
      zone: 'Zone A',
      capacity: 250,
      occupancy: 124,
      accessToken: token(),
    },
  });
  const gateB = await prisma.gate.upsert({
    where: { code: 'GATE-A-EXIT' },
    update: {},
    create: {
      code: 'GATE-A-EXIT',
      name: 'North Exit — Zone A',
      direction: GateDirection.EXIT,
      status: GateStatus.ONLINE,
      zone: 'Zone A',
      capacity: 250,
      occupancy: 124,
      accessToken: token(),
    },
  });

  // ─── Drivers + vehicles + subscriptions + cards ───────────────────
  const driverPassword = await argon2.hash('parksphere-driver');
  const drivers = [
    {
      email: 'raju@parksphere.local',
      fullName: 'Raju Kumaran',
      publicId: 'RAJU7690QW',
      phone: '+60123456001',
      plate: 'WXY1234',
      vehicleType: 'LORRY',
      planName: 'Lorry Monthly',
      priceCents: 35000,
      daysUntilExpiry: 23,
      subStatus: SubscriptionStatus.ACTIVE,
      cardUid: '04A21B3C',
      cardLabel: 'Driver Card #001',
    },
    {
      email: 'ahmad@parksphere.local',
      fullName: 'Ahmad Faizal',
      publicId: 'AHMA2210ZK',
      phone: '+60123456002',
      plate: 'WTC7788',
      vehicleType: 'CAR',
      planName: 'Staff Monthly',
      priceCents: 12000,
      daysUntilExpiry: 5,
      subStatus: SubscriptionStatus.ACTIVE,
      cardUid: '047B92E1',
      cardLabel: 'Driver Card #002',
    },
    {
      email: 'siti@parksphere.local',
      fullName: 'Siti Nurhaliza',
      publicId: 'SITI4451MN',
      phone: '+60123456003',
      plate: 'VAH9921',
      vehicleType: 'VAN',
      planName: 'Contractor Monthly',
      priceCents: 25000,
      daysUntilExpiry: 60,
      subStatus: SubscriptionStatus.ACTIVE,
      cardUid: '04C1F9D2',
      cardLabel: 'Driver Card #003',
    },
    {
      email: 'expired@parksphere.local',
      fullName: 'Tan Wei Ming',
      publicId: 'TANW0090PQ',
      phone: '+60123456004',
      plate: 'JPK3300',
      vehicleType: 'CAR',
      planName: 'Staff Monthly',
      priceCents: 12000,
      daysUntilExpiry: -3,
      subStatus: SubscriptionStatus.EXPIRED,
      cardUid: '04D3E882',
      cardLabel: 'Driver Card #004',
    },
  ];

  const driverIdByEmail = new Map<string, string>();

  for (const s of drivers) {
    const expiresAt = new Date(Date.now() + s.daysUntilExpiry * 24 * 60 * 60 * 1000);
    const startsAt = new Date(expiresAt.getTime() - 30 * 24 * 60 * 60 * 1000);

    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: driverPassword,
        role: UserRole.DRIVER,
        fullName: s.fullName,
        driver: {
          create: {
            publicId: s.publicId,
            phone: s.phone,
            fullName: s.fullName,
            vehicles: { create: { plate: s.plate, type: s.vehicleType } },
            subscriptions: {
              create: {
                planName: s.planName,
                priceCents: s.priceCents,
                status: s.subStatus,
                startsAt,
                expiresAt,
              },
            },
          },
        },
      },
      include: { driver: true },
    });

    if (!user.driver) continue;
    driverIdByEmail.set(s.email, user.driver.id);

    // Card for this driver. We use upsert-by-uid so re-running the seed is
    // idempotent (cards don't multiply on each run).
    const existing = await prisma.card.findUnique({ where: { uid: s.cardUid } });
    if (!existing) {
      await prisma.card.create({
        data: {
          uid: s.cardUid,
          label: s.cardLabel,
          status: CardStatus.ACTIVE,
          driverId: user.driver.id,
          issuedAt: startsAt,
          assignments: {
            create: {
              driverId: user.driver.id,
              reason: CardAssignmentReason.INITIAL_ISSUE,
            },
          },
        },
      });
    }
  }

  // ─── Extra cards for testing edge cases ───────────────────────────
  const inStockUid = '04E55A14';
  if (!(await prisma.card.findUnique({ where: { uid: inStockUid } }))) {
    await prisma.card.create({
      data: {
        uid: inStockUid,
        label: 'Spare #005 (in stock)',
        status: CardStatus.IN_STOCK,
      },
    });
  }

  const lostUid = '04F11C2B';
  if (!(await prisma.card.findUnique({ where: { uid: lostUid } }))) {
    await prisma.card.create({
      data: {
        uid: lostUid,
        label: 'Reported lost #006',
        status: CardStatus.LOST,
      },
    });
  }

  // ─── Pretty print ─────────────────────────────────────────────────
  console.log('\n┌─ Admin ────────────────────────────────────────────────');
  console.log('│  email=admin@parksphere.local  pw=parksphere-admin');
  console.log('├─ Drivers + cards ──────────────────────────────────────');
  for (const s of drivers) {
    console.log(
      `│  ${s.publicId.padEnd(10)}  card UID ${s.cardUid}  plate ${s.plate.padEnd(8)}  sub ${s.subStatus}`,
    );
  }
  console.log(`│  (unassigned) card UID ${inStockUid} — IN_STOCK`);
  console.log(`│  (unassigned) card UID ${lostUid} — LOST`);
  console.log('├─ Gates ─────────────────────────────────────────────────');
  console.log(`│  ${gateA.code}  token ${gateA.accessToken}`);
  console.log(`│  ${gateB.code}  token ${gateB.accessToken}`);
  console.log('├─ URLs ─────────────────────────────────────────────────');
  console.log('│  Landing  http://localhost:3000');
  console.log('│  Admin    http://localhost:3000/admin/login');
  console.log(`│  Monitor  http://localhost:3000/gate/${gateA.code}/monitor`);
  console.log('└────────────────────────────────────────────────────────\n');
  console.log('Driver password for all: parksphere-driver');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
