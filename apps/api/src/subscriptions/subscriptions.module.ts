import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { RenewalModule } from '../renewal/renewal.module';

// SubscriptionsModule depends on RenewalModule (for ReminderService +
// RenewalService). No reverse dependency exists, so a plain import works —
// no forwardRef needed.
@Module({
  imports: [RenewalModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
