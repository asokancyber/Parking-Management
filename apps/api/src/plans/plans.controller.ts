import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Request } from 'express';
import { UserRole } from '../common/enums';
import { PlansService } from './plans.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

class CreatePlanDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsInt() @Min(0) priceCents!: number;
  @IsInt() @Min(1) durationDays!: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

class UpdatePlanDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsInt() @Min(1) durationDays?: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  list(@Query('includeInactive') includeInactive?: string) {
    return this.plans.list(includeInactive === 'true');
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreatePlanDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.plans.create(dto, user.userId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.plans.update(id, dto, user.userId);
  }
}
