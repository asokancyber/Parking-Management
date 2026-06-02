import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Min, Max, IsOptional, IsISO8601, IsArray, ArrayMaxSize, ArrayMinSize, MaxLength } from 'class-validator';
import { Request } from 'express';
import { UserRole } from '../common/enums';
import { SubscriptionsService } from './subscriptions.service';
import { RenewalService } from '../renewal/renewal.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

class CreateSubDto {
  @IsString() driverId!: string;
  @IsString() planName!: string;
  @IsInt() @Min(0) priceCents!: number;
  @IsInt() @Min(1) @Max(3650) durationDays!: number;
  @IsOptional() @IsISO8601() startsAt?: string;
}

class ExtendDto {
  @IsInt() @Min(1) @Max(365)
  days!: number;
}

class RenewDto {
  @IsOptional() @IsInt() @Min(1) @Max(3650) days?: number;
  @IsOptional() @IsString() @MaxLength(120) paymentRef?: string;
}

class BulkRenewDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true })
  ids!: string[];
  @IsOptional() @IsInt() @Min(1) @Max(3650) days?: number;
  @IsOptional() @IsString() @MaxLength(120) paymentRef?: string;
}

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(
    private readonly subs: SubscriptionsService,
    private readonly renewals: RenewalService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  list(
    @Query('status') status?: string,
    @Query('expiringInDays') expiringInDays?: string,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.subs.list({
      status,
      expiringInDays: expiringInDays ? Number(expiringInDays) : undefined,
      search,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 25,
    });
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async stats() {
    const [active, expired, expiringSoon, pending, blacklisted] = await this.subs.stats();
    return { active, expired, expiringSoon, pending, blacklisted };
  }

  @Get('driver/:driverId/history')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  history(@Param('driverId') driverId: string) {
    return this.subs.historyForDriver(driverId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateSubDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.subs.create(
      {
        driverId: dto.driverId,
        planName: dto.planName,
        priceCents: dto.priceCents,
        durationDays: dto.durationDays,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      },
      user.userId,
    );
  }

  @Post(':id/extend')
  @Roles(UserRole.ADMIN)
  extend(@Param('id') id: string, @Body() dto: ExtendDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.subs.extend(id, dto.days, user.userId);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  cancel(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.subs.cancel(id, user.userId);
  }

  // Renew = a stronger "extend": continues the term from the right base
  // (current expiry if still active, today if lapsed), records payment ref,
  // re-schedules the full reminder fan from the new expiry.
  @Post(':id/renew')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  renew(@Param('id') id: string, @Body() dto: RenewDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.renewals.renew(id, { days: dto.days, paymentRef: dto.paymentRef, actorId: user.userId });
  }

  @Post('bulk-renew')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  bulkRenew(@Body() dto: BulkRenewDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.renewals.bulkRenew(dto.ids, {
      days: dto.days,
      paymentRef: dto.paymentRef,
      actorId: user.userId,
    });
  }
}
