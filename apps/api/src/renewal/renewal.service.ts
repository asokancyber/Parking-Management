import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReminderService } from './reminder.service';
import { SubscriptionStatus, AuditCategory, UserRole } from '../common/enums';

export interface RenewInput {
  paymentRef?: string;     // operator-typed (cash receipt #, bank-in ref)
  days?: number;           // override (defaults to plan duration on current sub)
  actorId?: string;
}

@Injectable()
export class RenewalService {
  private readonly logger = new Logger(RenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reminders: ReminderService,
  ) {}

  // Driver paid — extend their sub, mark renewed, cancel pending reminders,
  // schedule a fresh fan of future reminders.
  async renew(subId: string, input: RenewInput) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === SubscriptionStatus.BLACKLISTED) {
      throw new BadRequestException('Blacklisted subscriptions cannot be renewed; reactivate the driver first');
    }

    // Default renewal duration: same as the original term (in days between
    // startsAt and expiresAt). Operator can override.
    const originalSpanDays = Math.round(
      (sub.expiresAt.getTime() - sub.startsAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    const days = input.days ?? originalSpanDays;
    if (days < 1) throw new BadRequestException('Renewal days must be >= 1');

    // If sub is still active, continue from current expiry. If lapsed,
    // continue from today.
    const base = sub.expiresAt.getTime() > Date.now() ? sub.expiresAt : new Date();
    const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.subscription.update({
      where: { id: subId },
      data: {
        expiresAt: newExpiry,
        status: SubscriptionStatus.ACTIVE,
        lastRenewedAt: new Date(),
        lastRenewedFor: days,
        lastPaymentRef: input.paymentRef ?? null,
      },
    });

    await this.reminders.cancelPendingForSubscription(subId);
    await this.reminders.scheduleForSubscription(subId);

    await this.audit.log({
      category: AuditCategory.SUBSCRIPTION,
      action: 'subscription.renewed',
      actorId: input.actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Subscription',
      targetId: subId,
      metadata: { days, newExpiry, paymentRef: input.paymentRef ?? null },
    });

    return updated;
  }

  async bulkRenew(subIds: string[], input: Omit<RenewInput, 'days'> & { days?: number }) {
    const results = await Promise.allSettled(subIds.map((id) => this.renew(id, input)));
    const renewed = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results
      .map((r, i) => ({ id: subIds[i], r }))
      .filter((x) => x.r.status === 'rejected')
      .map((x) => ({ id: x.id, error: (x.r as PromiseRejectedResult).reason?.message ?? 'failed' }));
    return { renewed, failed };
  }

  // Cron: flip ACTIVE→EXPIRED→GRACE_PERIOD→LAPSED based on time. Idempotent.
  async runStateTransitions(): Promise<{ expired: number; toGrace: number; toLapsed: number }> {
    const now = new Date();
    let expired = 0;
    let toGrace = 0;
    let toLapsed = 0;

    // ACTIVE past expiry → GRACE_PERIOD (we skip the bare EXPIRED state on
    // the way in, going straight to GRACE so the entry stays allowed).
    const active = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE, expiresAt: { lt: now } },
      select: { id: true },
    });
    if (active.length > 0) {
      const r = await this.prisma.subscription.updateMany({
        where: { id: { in: active.map((a) => a.id) } },
        data: { status: SubscriptionStatus.GRACE_PERIOD },
      });
      toGrace = r.count;
      for (const a of active) {
        await this.audit.log({
          category: AuditCategory.SUBSCRIPTION,
          action: 'subscription.entered_grace',
          targetType: 'Subscription',
          targetId: a.id,
        });
      }
    }

    // GRACE_PERIOD past (expiresAt + gracePeriodDays) → LAPSED
    const inGrace = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.GRACE_PERIOD },
      select: { id: true, expiresAt: true, gracePeriodDays: true },
    });
    const lapsedIds = inGrace
      .filter((s) => s.expiresAt.getTime() + s.gracePeriodDays * 24 * 60 * 60 * 1000 < now.getTime())
      .map((s) => s.id);
    if (lapsedIds.length > 0) {
      const r = await this.prisma.subscription.updateMany({
        where: { id: { in: lapsedIds } },
        data: { status: SubscriptionStatus.LAPSED },
      });
      toLapsed = r.count;
      for (const id of lapsedIds) {
        await this.audit.log({
          category: AuditCategory.SUBSCRIPTION,
          action: 'subscription.lapsed',
          targetType: 'Subscription',
          targetId: id,
        });
      }
    }

    return { expired, toGrace, toLapsed };
  }
}
