import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RenewalService } from './renewal.service';
import { ReminderService } from './reminder.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RenewalScheduler implements OnModuleInit {
  private readonly logger = new Logger(RenewalScheduler.name);

  constructor(
    private readonly renewals: RenewalService,
    private readonly reminders: ReminderService,
    private readonly prisma: PrismaService,
  ) {}

  // On boot: backfill reminders for any ACTIVE sub that has no reminders
  // scheduled yet (eg. seeded subs, or subs created before this module
  // existed).
  async onModuleInit() {
    try {
      const orphans = await this.prisma.subscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
          reminders: { none: { status: 'SCHEDULED' } },
        },
        select: { id: true, driverId: true },
      });
      if (orphans.length > 0) {
        this.logger.log(`Backfilling reminders for ${orphans.length} sub(s)`);
        for (const o of orphans) await this.reminders.scheduleForSubscription(o.id);
      }
    } catch (err) {
      this.logger.warn(`Reminder backfill skipped: ${(err as Error).message}`);
    }
  }

  // Every 5 minutes: state transitions (ACTIVE→GRACE→LAPSED).
  @Cron(CronExpression.EVERY_5_MINUTES)
  async tickTransitions() {
    try {
      const r = await this.renewals.runStateTransitions();
      if (r.toGrace || r.toLapsed) {
        this.logger.log(`State transitions: ${r.toGrace} → grace, ${r.toLapsed} → lapsed`);
      }
    } catch (err) {
      this.logger.error(`State transition tick failed: ${(err as Error).message}`);
    }
  }
}
