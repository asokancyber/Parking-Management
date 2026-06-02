import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, Max, Min, IsOptional, ArrayMaxSize } from 'class-validator';
import { Request } from 'express';
import { UserRole } from '../common/enums';
import { SettingsService } from './settings.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

class UpdateTapDebounceDto {
  @IsInt() @Min(0) @Max(60_000)
  ms!: number;
}

class UpdateReminderScheduleDto {
  @IsArray() @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(365, { each: true })
  daysBeforeExpiry!: number[];

  @IsOptional() @IsBoolean()
  includeGrace?: boolean;

  @IsOptional() @IsBoolean()
  includeLapsed?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(23)
  hourOfDay?: number;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  all() {
    return this.settings.getAll();
  }

  @Put('tap-debounce')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateTapDebounce(@Body() dto: UpdateTapDebounceDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    const value = await this.settings.setTapDebounceMs(dto.ms, user.userId);
    return { tapDebounceMs: value };
  }

  @Put('reminder-schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateReminderSchedule(@Body() dto: UpdateReminderScheduleDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    const value = await this.settings.setReminderSchedule(dto, user.userId);
    return { reminderSchedule: value };
  }
}
