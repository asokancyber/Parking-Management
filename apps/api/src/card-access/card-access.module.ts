import { Module } from '@nestjs/common';
import { CardAccessController } from './card-access.controller';
import { CardAccessService } from './card-access.service';
import { TapHistoryController } from './tap-history.controller';
import { TapHistoryService } from './tap-history.service';
import { CardsModule } from '../cards/cards.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [CardsModule, SubscriptionsModule],
  controllers: [CardAccessController, TapHistoryController],
  providers: [CardAccessService, TapHistoryService],
})
export class CardAccessModule {}
