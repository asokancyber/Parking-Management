import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../common/enums';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  list(
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.vehicles.list({
      search,
      driverId,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 25,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateVehicleDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.vehicles.create(dto, user.userId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.vehicles.update(id, dto, user.userId);
  }
}
