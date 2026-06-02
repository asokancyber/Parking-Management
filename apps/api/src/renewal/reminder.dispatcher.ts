import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderService } from './reminder.service';
import { WhatsAppAdapter } from './channels/whatsapp.adapter';
import { getTemplate } from './templates';
import { ReminderChannel, ReminderStatus, AuditCategory } from '../common/enums';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReminderDispatcher {
  private readonly logger = new Logger(ReminderDispatcher.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: ReminderService,
    private readonly whatsapp: WhatsAppAdapter,
    private readonly audit: AuditService,
  ) {}

  // Runs every minute. The guard prevents overlap if a long send chain
  // hasn't finished by the next tick.
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.reminders.fetchDue(50);
      if (due.length === 0) return;
      this.logger.log(`Dispatching ${due.length} due reminders`);
      for (const r of due) await this.dispatchOne(r.id);
    } catch (err) {
      this.logger.error(`Dispatcher tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  // Process a single reminder. We re-fetch with FOR UPDATE-style guarded
  // status update so two dispatchers can't double-send (SQLite is single-
  // writer, so this is effectively safe; Postgres requires the SELECT-then-
  // UPDATE pattern below which works on both engines).
  async dispatchOne(reminderId: string): Promise<void> {
    // Atomic claim: only proceed if still SCHEDULED.
    const claim = await this.prisma.reminder.updateMany({
      where: { id: reminderId, status: ReminderStatus.SCHEDULED },
      data: { status: ReminderStatus.SENDING, attempts: { increment: 1 } },
    });
    if (claim.count === 0) return; // already picked up

    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { driver: true, subscription: true },
    });
    if (!reminder) return;
    if (!reminder.driver || !reminder.subscription) {
      await this.failOut(reminderId, 'Driver or subscription missing');
      return;
    }

    if (reminder.driver.whatsappOptOut && reminder.channel === ReminderChannel.WHATSAPP) {
      await this.cancel(reminderId, 'Driver opted out of WhatsApp');
      return;
    }

    // Render the template against the live driver + sub context. kind is a
    // string now (could be a fixed kind or a custom T_MINUS_<n>).
    const tpl = getTemplate(reminder.kind);
    const daysLeft = Math.ceil(
      (reminder.subscription.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    const body = tpl.body({
      driverFirstName: reminder.driver.fullName.split(' ')[0],
      driverFullName: reminder.driver.fullName,
      planName: reminder.subscription.planName,
      priceMyr: (reminder.subscription.priceCents / 100).toFixed(2),
      expiresAtDate: reminder.subscription.expiresAt.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      }),
      daysLeft,
      gracePeriodDays: reminder.subscription.gracePeriodDays,
      publicId: reminder.driver.publicId,
    });

    let result;
    if (reminder.channel === ReminderChannel.WHATSAPP) {
      result = await this.whatsapp.send({
        toPhone: reminder.driver.phone,
        body,
        templateName: tpl.name,
      });
    } else {
      // SMS / EMAIL adapters not implemented in this phase.
      result = { mode: 'dry' as const, status: 'DRY_RUN' as const };
    }

    const now = new Date();
    if (result.status === 'SENT') {
      await this.prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.SENT,
          sentAt: now,
          externalId: result.externalId ?? null,
          renderedBody: body,
          recipientPhone: reminder.driver.phone,
        },
      });
    } else if (result.status === 'DRY_RUN') {
      await this.prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.DRY_RUN,
          sentAt: now,
          renderedBody: body,
          recipientPhone: reminder.driver.phone,
        },
      });
    } else {
      // FAILED — keep attempts intact, restore to SCHEDULED unless we're
      // past max attempts in which case finalise as FAILED.
      const willRetry = (reminder.attempts ?? 0) < 3;
      await this.prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: willRetry ? ReminderStatus.SCHEDULED : ReminderStatus.FAILED,
          failedAt: willRetry ? null : now,
          failReason: result.error ?? 'Unknown error',
          renderedBody: body,
          recipientPhone: reminder.driver.phone,
          // Backoff: push next attempt out 5/15/45 minutes.
          scheduledFor: willRetry
            ? new Date(Date.now() + 5 * Math.pow(3, reminder.attempts) * 60 * 1000)
            : undefined,
        },
      });
    }

    await this.audit.log({
      category: AuditCategory.SUBSCRIPTION,
      action: `reminder.${result.status.toLowerCase()}`,
      targetType: 'Reminder',
      targetId: reminderId,
      metadata: {
        kind: reminder.kind,
        channel: reminder.channel,
        mode: result.mode,
        driverPublicId: reminder.driver.publicId,
        error: result.status === 'FAILED' ? result.error : undefined,
      },
    });
  }

  private async failOut(id: string, reason: string) {
    await this.prisma.reminder.update({
      where: { id },
      data: { status: ReminderStatus.FAILED, failedAt: new Date(), failReason: reason },
    });
  }
  private async cancel(id: string, reason: string) {
    await this.prisma.reminder.update({
      where: { id },
      data: { status: ReminderStatus.CANCELLED, cancelledAt: new Date(), failReason: reason },
    });
  }
}
