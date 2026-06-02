import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RenewalService } from './renewal.service';
import { RenewalScheduler } from './renewal.scheduler';
import { ReminderService } from './reminder.service';
import { ReminderDispatcher } from './reminder.dispatcher';
import { ReminderController } from './reminder.controller';
import { WhatsAppAdapter } from './channels/whatsapp.adapter';

// Order matters: ScheduleModule.forRoot() must be loaded once. RenewalService
// + ReminderService are exported so SubscriptionsModule (and others) can
// inject them.
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ReminderController],
  providers: [
    RenewalService,
    ReminderService,
    WhatsAppAdapter,
    RenewalScheduler,
    ReminderDispatcher,
  ],
  exports: [RenewalService, ReminderService, WhatsAppAdapter],
})
export class RenewalModule {}
