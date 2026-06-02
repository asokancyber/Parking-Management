import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { GateStatus, UserRole } from '../common/enums';
import { GatesService } from './gates.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

class ManualOpenDto {
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

class SetStatusDto {
  @IsIn(['ONLINE', 'OFFLINE', 'MAINTENANCE'])
  status!: GateStatus;
}

@Controller('gates')
export class GatesController {
  constructor(private readonly gates: GatesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  list() {
    return this.gates.list();
  }

  @Get('public/:code')
  async publicByCode(@Param('code') code: string) {
    const g = await this.gates.byCode(code);
    return {
      id: g.id,
      code: g.code,
      name: g.name,
      direction: g.direction,
      status: g.status,
      zone: g.zone,
      capacity: g.capacity,
      occupancy: g.occupancy,
    };
  }

  @Post(':id/rotate-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  rotate(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.gates.rotateAccessToken(id, user.userId);
  }

  @Post(':id/manual-open')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  manualOpen(@Param('id') id: string, @Body() dto: ManualOpenDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.gates.manualOpen(id, dto.reason, user.userId, req.ip);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.gates.setStatus(id, dto.status, user.userId);
  }
}
