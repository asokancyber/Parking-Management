import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionStatus, AuditCategory, UserRole } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReminderService } from '../renewal/reminder.service';

export interface SubscriptionCheck {
  ok: boolean;
  reason?: string;
  status?: SubscriptionStatus;
  expiresAt?: Date;
}

export interface ListOptions {
  status?: string;
  expiringInDays?: number;
  search?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reminders: ReminderService,
  ) {}

  async list(opts: ListOptions = {}) {
    const take = Math.min(100, Math.max(1, opts.take ?? 25));
    const skip = Math.max(0, opts.skip ?? 0);
    const search = (opts.search ?? '').trim();
    const now = new Date();

    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (opts.expiringInDays) {
      const horizon = new Date(now.getTime() + opts.expiringInDays * 24 * 60 * 60 * 1000);
      where.expiresAt = { lte: horizon, gte: now };
      where.status = SubscriptionStatus.ACTIVE;
    }
    if (search) {
      Object.assign(where, {
        OR: [
          { driver: { fullName: { contains: search } } },
          { driver: { publicId: { contains: search.toUpperCase() } } },
          { planName: { contains: search } },
        ],
      });
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        orderBy: { expiresAt: 'desc' },
        skip,
        take,
        include: {
          driver: { select: { id: true, publicId: true, fullName: true, phone: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  stats() {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.prisma.$transaction([
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.EXPIRED } }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE, expiresAt: { lte: in7 } },
      }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.PENDING_PAYMENT } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.BLACKLISTED } }),
    ]);
  }

  async checkForDriver(driverId: string): Promise<SubscriptionCheck> {
    const sub = await this.prisma.subscription.findFirst({
      where: { driverId },
      orderBy: { expiresAt: 'desc' },
    });
    if (!sub) return { ok: false, reason: 'No subscription on file' };

    const status = sub.status as SubscriptionStatus;

    if (status === SubscriptionStatus.BLACKLISTED) return { ok: false, reason: 'Driver blacklisted', status };
    if (status === SubscriptionStatus.SUSPENDED) return { ok: false, reason: 'Subscription suspended', status };
    if (status === SubscriptionStatus.PENDING_PAYMENT) return { ok: false, reason: 'Payment pending', status };
    if (sub.expiresAt.getTime() < Date.now() || status === SubscriptionStatus.EXPIRED) {
      if (status !== SubscriptionStatus.EXPIRED) {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });
      }
      return { ok: false, reason: 'Subscription expired', status: SubscriptionStatus.EXPIRED, expiresAt: sub.expiresAt };
    }
    return { ok: true, status, expiresAt: sub.expiresAt };
  }

  async historyForDriver(driverId: string) {
    return this.prisma.subscription.findMany({
      where: { driverId },
      orderBy: { expiresAt: 'desc' },
    });
  }

  async create(
    input: {
      driverId: string;
      planName: string;
      priceCents: number;
      durationDays: number;
      startsAt?: Date;
      status?: SubscriptionStatus;
    },
    actorId?: string,
  ) {
    const driver = await this.prisma.driver.findUnique({ where: { id: input.driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    if (input.durationDays <= 0) throw new BadRequestException('durationDays must be > 0');

    const startsAt = input.startsAt ?? new Date();
    const expiresAt = new Date(startsAt.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

    const created = await this.prisma.subscription.create({
      data: {
        driverId: input.driverId,
        planName: input.planName,
        priceCents: input.priceCents,
        startsAt,
        expiresAt,
        status: input.status ?? SubscriptionStatus.ACTIVE,
      },
    });
    await this.audit.log({
      category: AuditCategory.SUBSCRIPTION,
      action: 'subscription.created',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Subscription',
      targetId: created.id,
      metadata: { driverId: input.driverId, planName: input.planName, durationDays: input.durationDays, expiresAt },
    });

    // Fan out the reminder schedule (T-14, T-7, T-3, T-1, T-0, GRACE, LAPSED)
    // — only future ones survive. Driver opt-out is checked by the service.
    await this.reminders.scheduleForSubscription(created.id).catch(() => undefined);

    return created;
  }

  async extend(subscriptionId: string, days: number, actorId?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    const base = sub.expiresAt.getTime() > Date.now() ? sub.expiresAt : new Date();
    const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { expiresAt: newExpiry, status: SubscriptionStatus.ACTIVE },
    });
    await this.audit.log({
      category: AuditCategory.SUBSCRIPTION,
      action: 'subscription.extended',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Subscription',
      targetId: subscriptionId,
      metadata: { days, newExpiry },
    });

    // Reset the reminder fan to match the new expiry.
    await this.reminders.cancelPendingForSubscription(subscriptionId).catch(() => undefined);
    await this.reminders.scheduleForSubscription(subscriptionId).catch(() => undefined);
    return updated;
  }

  async cancel(subscriptionId: string, actorId?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.SUSPENDED },
    });
    await this.audit.log({
      category: AuditCategory.SUBSCRIPTION,
      action: 'subscription.cancelled',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Subscription',
      targetId: subscriptionId,
    });
    return updated;
  }
}
