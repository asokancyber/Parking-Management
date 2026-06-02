import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { GatesModule } from './gates/gates.module';
import { CardsModule } from './cards/cards.module';
import { CardAccessModule } from './card-access/card-access.module';
import { PlansModule } from './plans/plans.module';
import { ReportsModule } from './reports/reports.module';
import { RenewalModule } from './renewal/renewal.module';
import { SettingsModule } from './settings/settings.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuditModule,
    RealtimeModule,
    SettingsModule,
    AuthModule,
    DriversModule,
    VehiclesModule,
    SubscriptionsModule,
    GatesModule,
    CardsModule,
    CardAccessModule,
    PlansModule,
    ReportsModule,
    RenewalModule,
  ],
})
export class AppModule {}
