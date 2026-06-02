import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '../common/enums';

export interface DailyBucket {
  date: string;
  granted: number;
  denied: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Revenue for the calendar month containing `at` (defaults to now).
  // Counted from subscriptions whose startsAt falls in that month — keeps
  // semantics simple (no proration). Snapshot prices on the row are used,
  // so plan edits don't retroactively change the number.
  async monthlyRevenue(at?: Date) {
    const ref = at ?? new Date();
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const rows = await this.prisma.subscription.findMany({
      where: { startsAt: { gte: start, lt: end } },
      select: { priceCents: true, status: true },
    });
    const totalCents = rows.reduce((s, r) => s + r.priceCents, 0);
    const activeCents = rows
      .filter((r) => r.status === SubscriptionStatus.ACTIVE)
      .reduce((s, r) => s + r.priceCents, 0);
    return {
      monthStart: start.toISOString(),
      monthEnd: end.toISOString(),
      count: rows.length,
      totalCents,
      activeCents,
    };
  }

  // 14-day rolling histogram of taps, bucketed per day.
  async tapsLast14Days(): Promise<DailyBucket[]> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);
    const rows = await this.prisma.cardTapEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, result: true },
    });
    const buckets = new Map<string, DailyBucket>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, granted: 0, denied: 0 });
    }
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      if (r.result === 'GRANTED') b.granted += 1;
      else b.denied += 1;
    }
    return Array.from(buckets.values());
  }

  async expiringSoon(days: number) {
    const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { lte: horizon, gte: new Date() },
      },
      orderBy: { expiresAt: 'asc' },
      include: {
        driver: { select: { id: true, publicId: true, fullName: true, phone: true } },
      },
    });
  }

  async denialBreakdown(sinceHours: number) {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const rows = await this.prisma.cardTapEvent.groupBy({
      by: ['result'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return rows
      .map((r) => ({ result: r.result, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  // CSV export endpoints (server-side, no pagination cap)
  async exportDrivers(): Promise<string> {
    const drivers = await this.prisma.driver.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { email: true } },
        vehicles: true,
        subscriptions: { orderBy: { expiresAt: 'desc' }, take: 1 },
      },
    });
    return toCsv(
      ['Public ID', 'Full Name', 'Email', 'Phone', 'Company', 'Vehicles', 'Plan', 'Sub Status', 'Sub Expires', 'Created'],
      drivers.map((d) => [
        d.publicId,
        d.fullName,
        d.user.email,
        d.phone,
        d.company ?? '',
        d.vehicles.map((v) => v.plate).join(' / '),
        d.subscriptions[0]?.planName ?? '',
        d.subscriptions[0]?.status ?? '',
        d.subscriptions[0]?.expiresAt.toISOString().slice(0, 10) ?? '',
        d.createdAt.toISOString().slice(0, 10),
      ]),
    );
  }

  async exportSubscriptions(): Promise<string> {
    const subs = await this.prisma.subscription.findMany({
      orderBy: { startsAt: 'desc' },
      include: { driver: { select: { publicId: true, fullName: true } } },
    });
    return toCsv(
      ['Driver ID', 'Driver Name', 'Plan', 'Price MYR', 'Status', 'Starts', 'Expires', 'Created'],
      subs.map((s) => [
        s.driver.publicId,
        s.driver.fullName,
        s.planName,
        (s.priceCents / 100).toFixed(2),
        s.status,
        s.startsAt.toISOString().slice(0, 10),
        s.expiresAt.toISOString().slice(0, 10),
        s.createdAt.toISOString(),
      ]),
    );
  }

  async exportTaps(opts: { from?: Date; to?: Date } = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (opts.from || opts.to) {
      where.createdAt = {
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lte: opts.to } : {}),
      };
    }
    const taps = await this.prisma.cardTapEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000, // hard cap for SQLite memory safety
      include: {
        gate: { select: { code: true, name: true, direction: true } },
        driver: { select: { publicId: true, fullName: true } },
        vehicle: { select: { plate: true } },
      },
    });
    return toCsv(
      ['Timestamp', 'Result', 'Reason', 'Card UID', 'Driver ID', 'Driver', 'Plate', 'Gate', 'Direction'],
      taps.map((t) => [
        t.createdAt.toISOString(),
        t.result,
        t.reason ?? '',
        t.cardUid,
        t.driver?.publicId ?? '',
        t.driver?.fullName ?? '',
        t.vehicle?.plate ?? '',
        t.gate.code,
        t.gate.direction,
      ]),
    );
  }

  async exportAudit(opts: { from?: Date; to?: Date } = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (opts.from || opts.to) {
      where.createdAt = {
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lte: opts.to } : {}),
      };
    }
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });
    return toCsv(
      ['Timestamp', 'Category', 'Action', 'Actor Role', 'Actor ID', 'Target Type', 'Target ID', 'IP', 'Metadata'],
      rows.map((r) => [
        r.createdAt.toISOString(),
        r.category,
        r.action,
        r.actorRole ?? '',
        r.actorId ?? '',
        r.targetType ?? '',
        r.targetId ?? '',
        r.ipAddress ?? '',
        r.metadata ?? '',
      ]),
    );
  }
}

// Minimal RFC4180 CSV writer. Quotes fields containing commas, quotes, or
// newlines; doubles internal quotes.
function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const out: string[] = [headers.map(esc).join(',')];
  for (const r of rows) out.push(r.map(esc).join(','));
  return out.join('\n') + '\n';
}
