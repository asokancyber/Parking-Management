import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../common/enums';
import { TapHistoryService } from './tap-history.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

@Controller('tap-events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TapHistoryController {
  constructor(private readonly taps: TapHistoryService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  list(
    @Query('gateId') gateId?: string,
    @Query('driverId') driverId?: string,
    @Query('cardId') cardId?: string,
    @Query('cardUid') cardUid?: string,
    @Query('result') result?: string,
    @Query('granted') granted?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.taps.list({
      gateId,
      driverId,
      cardId,
      cardUid,
      result,
      granted: granted === 'true' ? true : granted === 'false' ? false : undefined,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  summary(@Query('from') from?: string) {
    return this.taps.summary(from ? new Date(from) : undefined);
  }
}
