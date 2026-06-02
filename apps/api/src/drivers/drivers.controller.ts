import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';
import { Request } from 'express';
import { UserRole } from '../common/enums';
import { DriversService } from './drivers.service';
import { CreateDriverDto, UpdateDriverDto, ResetPasswordDto, LockAccountDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

class SuspendDto {
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

class ForceChangeDto {
  @IsBoolean()
  force!: boolean;
}

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  list(
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.drivers.list({
      search,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 25,
    });
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.findByUserId(user.userId);
  }

  // Lookup driver by email — used by the onboarding wizard. Returns null if
  // not found (200 with null body), letting the wizard branch without
  // treating "not found" as an error.
  @Get('by-email/:email')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  byEmail(@Param('email') email: string) {
    return this.drivers.findByEmail(email);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  detail(@Param('id') id: string) {
    return this.drivers.findDetail(id);
  }

  @Get('by-public-id/:publicId')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  byPublicId(@Param('publicId') publicId: string) {
    return this.drivers.findByPublicId(publicId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateDriverDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.create(dto, user.userId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.update(id, dto, user.userId);
  }

  @Post(':id/suspend')
  @Roles(UserRole.ADMIN)
  suspend(@Param('id') id: string, @Body() dto: SuspendDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.suspend(id, dto.reason, user.userId);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.ADMIN)
  reactivate(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.reactivate(id, user.userId);
  }

  // ─── Password / account security actions ──────────────────────────────

  @Post(':id/reset-password')
  @Roles(UserRole.ADMIN)
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.resetPassword(id, dto.reason, user.userId);
  }

  // Lightweight resend — sends portal URL + username only, no password change.
  // For "driver lost the WhatsApp message" cases.
  @Post(':id/resend-credentials')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  resendCredentials(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.resendCredentials(id, user.userId);
  }

  @Post(':id/force-change')
  @Roles(UserRole.ADMIN)
  forceChange(@Param('id') id: string, @Body() dto: ForceChangeDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.setForceChange(id, dto.force, user.userId);
  }

  @Post(':id/lock')
  @Roles(UserRole.ADMIN)
  lock(@Param('id') id: string, @Body() dto: LockAccountDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.lock(id, dto.reason, user.userId);
  }

  @Post(':id/unlock')
  @Roles(UserRole.ADMIN)
  unlock(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.drivers.unlock(id, user.userId);
  }
}
