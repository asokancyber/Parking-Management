import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { RenewalModule } from '../renewal/renewal.module';

// Imports RenewalModule for WhatsAppAdapter (welcome + reset notifications).
@Module({
  imports: [RenewalModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
