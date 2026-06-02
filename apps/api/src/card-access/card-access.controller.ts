import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Request } from 'express';
import { CardAccessService } from './card-access.service';

class TapDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  cardUid!: string;
}

@Controller('card-access')
export class CardAccessController {
  constructor(private readonly access: CardAccessService) {}

  // Called by an RFID/NFC reader (or the admin simulator). The reader proves
  // itself with the gate's accessToken in the Authorization header; the
  // payload contains only the card UID the reader picked up.
  @Post('tap')
  tap(
    @Body() dto: TapDto,
    @Headers('authorization') authz: string | undefined,
    @Req() req: Request,
  ) {
    const token = extractBearer(authz);
    if (!token) throw new UnauthorizedException('Missing gate access token');
    return this.access.tap({
      gateAccessToken: token,
      cardUid: dto.cardUid,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}
