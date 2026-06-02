import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../common/enums';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  list(
    @Query('category') category?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({
      category,
      actorId,
      targetType,
      targetId,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  stats() {
    return this.audit.categoryStats();
  }
}
