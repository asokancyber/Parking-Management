import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../common/enums';
import { CardsService } from './cards.service';
import { IssueCardDto, AssignCardDto, UpdateCardStatusDto, ReplaceCardDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

@Controller('cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  list() {
    return this.cards.list();
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  stats() {
    return this.cards.stats();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  byId(@Param('id') id: string) {
    return this.cards.byId(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  issue(@Body() dto: IssueCardDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.cards.issue(dto, user.userId);
  }

  @Put(':id/assign')
  @Roles(UserRole.ADMIN)
  assign(@Param('id') id: string, @Body() dto: AssignCardDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.cards.assign(id, dto, user.userId);
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN)
  setStatus(@Param('id') id: string, @Body() dto: UpdateCardStatusDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.cards.setStatus(id, dto, user.userId);
  }

  @Post(':id/replace')
  @Roles(UserRole.ADMIN)
  replace(@Param('id') id: string, @Body() dto: ReplaceCardDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.cards.replace(id, dto, user.userId);
  }
}
