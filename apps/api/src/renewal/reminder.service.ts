import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ReminderChannel, ReminderStatus, SubscriptionStatus } from '../common/enums';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // Plan the full reminder fan for a (newly created or renewed) sub based on
  // the operator-configured schedule (Settings → reminderSchedule). Skips
  // slots already in the past.
  async scheduleForSubscription(subscriptionId: string): Promise<number> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { driver: true },
    });
    if (!sub || !sub.driver) return 0;
    if (sub.driver.whatsappOptOut) return 0;

    const schedule = await this.settings.getReminderSchedule();
    const channel = (sub.driver.preferredChannel ?? 'WHATSAPP') as ReminderChannel;
    const now = Date.now();

    type Slot = { kind: string; scheduledFor: Date };
    const slots: Slot[] = [];

    // T-N reminders (n days before expiry, plus T_ZERO when n=0).
    for (const days of schedule.daysBeforeExpiry) {
      const date = new Date(sub.expiresAt);
      date.setDate(date.getDate() - days);
      date.setHours(schedule.hourOfDay, 0, 0, 0);
      if (date.getTime() <= now) continue;
      const kind = days === 0 ? 'T_ZERO' : `T_MINUS_${days}`;
      slots.push({ kind, scheduledFor: date });
    }

    if (schedule.includeGrace) {
      const date = new Date(sub.expiresAt);
      date.setDate(date.getDate() + 1);
      date.setHours(schedule.hourOfDay, 0, 0, 0);
      if (date.getTime() > now) slots.push({ kind: 'GRACE_1', scheduledFor: date });
    }
    if (schedule.includeLapsed) {
      const date = new Date(sub.expiresAt);
      date.setDate(date.getDate() + sub.gracePeriodDays + 1);
      date.setHours(schedule.hourOfDay, 0, 0, 0);
      if (date.getTime() > now) slots.push({ kind: 'LAPSED', scheduledFor: date });
    }

    if (slots.length === 0) return 0;

    await this.prisma.reminder.createMany({
      data: slots.map((s) => ({
        driverId: sub.driverId,
        subscriptionId: sub.id,
        kind: s.kind,
        channel,
        status: ReminderStatus.SCHEDULED,
        scheduledFor: s.scheduledFor,
      })),
    });

    this.logger.log(`Scheduled ${slots.length} reminders for sub ${sub.id} (driver ${sub.driver.publicId})`);
    return slots.length;
  }

  async cancelPendingForSubscription(subscriptionId: string): Promise<number> {
    const r = await this.prisma.reminder.updateMany({
      where: { subscriptionId, status: ReminderStatus.SCHEDULED },
      data: { status: ReminderStatus.CANCELLED, cancelledAt: new Date() },
    });
    if (r.count > 0) this.logger.log(`Cancelled ${r.count} pending reminders for sub ${subscriptionId}`);
    return r.count;
  }

  // Bulk regenerate: cancel all SCHEDULED reminders for all ACTIVE / GRACE
  // subs, then re-schedule each from the current settings. Used when the
  // operator changes the reminder schedule and wants it applied retroactively.
  async regenerateAllActive(): Promise<{ cancelled: number; subsTouched: number; scheduled: number }> {
    const subs = await this.prisma.subscription.findMany({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] } },
      select: { id: true },
    });
    const cancelled = await this.prisma.reminder.updateMany({
      where: { subscriptionId: { in: subs.map((s) => s.id) }, status: ReminderStatus.SCHEDULED },
      data: { status: ReminderStatus.CANCELLED, cancelledAt: new Date() },
    });
    let scheduled = 0;
    for (const s of subs) scheduled += await this.scheduleForSubscription(s.id);
    return { cancelled: cancelled.count, subsTouched: subs.length, scheduled };
  }

  async fetchDue(limit = 50) {
    return this.prisma.reminder.findMany({
      where: {
        status: ReminderStatus.SCHEDULED,
        scheduledFor: { lte: new Date() },
        attempts: { lt: 3 },
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
      include: { driver: true, subscription: true },
    });
  }
}
