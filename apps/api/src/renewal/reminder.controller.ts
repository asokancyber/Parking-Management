import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { UserRole, ReminderStatus } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderDispatcher } from './reminder.dispatcher';
import { ReminderService } from './reminder.service';
import { WhatsAppAdapter } from './channels/whatsapp.adapter';
import { listTemplates } from './templates';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

class SendNowDto {
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

@Controller('reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReminderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: ReminderDispatcher,
    private readonly whatsapp: WhatsAppAdapter,
    private readonly reminders: ReminderService,
  ) {}

  @Post('regenerate')
  @Roles(UserRole.ADMIN)
  regenerate() {
    return this.reminders.regenerateAllActive();
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async list(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('kind') kind?: string,
    @Query('driverId') driverId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const t = Math.min(200, Math.max(1, take ? Number(take) : 50));
    const s = Math.max(0, skip ? Number(skip) : 0);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (kind) where.kind = kind;
    if (driverId) where.driverId = driverId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reminder.findMany({
        where,
        orderBy: { scheduledFor: 'desc' },
        skip: s,
        take: t,
        include: {
          driver: { select: { publicId: true, fullName: true, phone: true } },
          subscription: { select: { planName: true, expiresAt: true } },
        },
      }),
      this.prisma.reminder.count({ where }),
    ]);
    return { items, total, skip: s, take: t };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async stats() {
    const groups = await this.prisma.reminder.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    for (const g of groups) byStatus[g.status] = g._count._all;
    return { byStatus };
  }

  @Get('config')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  config() {
    return {
      whatsapp: {
        mode: this.whatsapp.modeLabel(),
        live: this.whatsapp.isLive(),
        instructions: this.whatsapp.isLive()
          ? 'WhatsApp is live via Twilio. Templates submitted to Meta will deliver to verified recipients.'
          : 'WhatsApp is in DRY-RUN mode. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in apps/api/.env to go live.',
      },
      templates: listTemplates().map((t) => ({
        kind: t.kind,
        name: t.name,
        preview: t.body({
          driverFirstName: 'Raju',
          driverFullName: 'Raju Kumaran',
          planName: 'Lorry Monthly',
          priceMyr: '350.00',
          expiresAtDate: '24 Jun 2026',
          daysLeft: 7,
          gracePeriodDays: 3,
          publicId: 'RAJU7690QW',
        }),
      })),
    };
  }

  // Operator override: send a SCHEDULED reminder right now (skips its
  // scheduledFor). The dispatcher handles the actual send.
  @Post(':id/send-now')
  @Roles(UserRole.ADMIN)
  async sendNow(@Param('id') id: string, @Body() _dto: SendNowDto, @Req() _req: Request) {
    // Bump scheduledFor to now and let the dispatcher pick it up in the
    // next ~minute. Or dispatch synchronously to give immediate feedback:
    await this.prisma.reminder.updateMany({
      where: { id, status: ReminderStatus.SCHEDULED },
      data: { scheduledFor: new Date(Date.now() - 1000) },
    });
    await this.dispatcher.dispatchOne(id);
    return this.prisma.reminder.findUnique({ where: { id } });
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  async cancel(@Param('id') id: string) {
    await this.prisma.reminder.updateMany({
      where: { id, status: ReminderStatus.SCHEDULED },
      data: { status: ReminderStatus.CANCELLED, cancelledAt: new Date() },
    });
    return this.prisma.reminder.findUnique({ where: { id } });
  }
}
