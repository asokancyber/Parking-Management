import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../common/enums';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async summary() {
    const [revenue, daily, expiring, denials] = await Promise.all([
      this.reports.monthlyRevenue(),
      this.reports.tapsLast14Days(),
      this.reports.expiringSoon(14),
      this.reports.denialBreakdown(24),
    ]);
    return { revenue, daily, expiring, denials };
  }

  @Get('export/drivers.csv')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Header('content-type', 'text/csv')
  @Header('content-disposition', 'attachment; filename="drivers.csv"')
  exportDrivers() {
    return this.reports.exportDrivers();
  }

  @Get('export/subscriptions.csv')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Header('content-type', 'text/csv')
  @Header('content-disposition', 'attachment; filename="subscriptions.csv"')
  exportSubs() {
    return this.reports.exportSubscriptions();
  }

  @Get('export/taps.csv')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Header('content-type', 'text/csv')
  @Header('content-disposition', 'attachment; filename="taps.csv"')
  exportTaps(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.exportTaps({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('export/audit.csv')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Header('content-type', 'text/csv')
  @Header('content-disposition', 'attachment; filename="audit.csv"')
  exportAudit(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.exportAudit({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
