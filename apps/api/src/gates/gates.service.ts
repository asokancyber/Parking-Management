import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuditCategory, GateDirection, GateStatus, TapResult, UserRole } from '../common/enums';

@Injectable()
export class GatesService {
  private readonly logger = new Logger(GatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  list() {
    return this.prisma.gate.findMany({ orderBy: { code: 'asc' } });
  }

  async byCode(code: string) {
    const gate = await this.prisma.gate.findUnique({ where: { code } });
    if (!gate) throw new NotFoundException(`Gate '${code}' not found`);
    return gate;
  }

  async byId(id: string) {
    const gate = await this.prisma.gate.findUnique({ where: { id } });
    if (!gate) throw new NotFoundException('Gate not found');
    return gate;
  }

  async rotateAccessToken(id: string, actorId?: string) {
    const gate = await this.byId(id);
    const token = randomBytes(24).toString('base64url');
    const updated = await this.prisma.gate.update({
      where: { id: gate.id },
      data: { accessToken: token },
    });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'gate.access_token_rotated',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Gate',
      targetId: gate.id,
    });
    return updated;
  }

  // Emergency / supervisor override. Opens the gate WITHOUT a card. Always
  // logged with the actor + reason. Adjusts occupancy the same way a real
  // tap would.
  async manualOpen(id: string, reason: string | undefined, actorId?: string, ip?: string) {
    const gate = await this.byId(id);
    if (gate.direction === GateDirection.ENTRY) {
      await this.prisma.gate.update({
        where: { id: gate.id },
        data: {
          occupancy: Math.min(gate.capacity || Number.MAX_SAFE_INTEGER, gate.occupancy + 1),
        },
      });
    } else if (gate.direction === GateDirection.EXIT) {
      await this.prisma.gate.update({
        where: { id: gate.id },
        data: { occupancy: Math.max(0, gate.occupancy - 1) },
      });
    }

    const event = await this.prisma.cardTapEvent.create({
      data: {
        gateId: gate.id,
        cardUid: 'MANUAL-OVERRIDE',
        result: TapResult.GRANTED,
        reason: reason ?? 'Manual operator override',
        ipAddress: ip ?? null,
      },
      select: { id: true, createdAt: true },
    });

    await this.audit.log({
      category: AuditCategory.GATE_COMMAND,
      action: 'gate.manual_open',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Gate',
      targetId: gate.id,
      ipAddress: ip,
      metadata: { reason },
    });

    this.realtime.broadcastCardTap({
      id: event.id,
      at: event.createdAt.toISOString(),
      gateId: gate.id,
      gateCode: gate.code,
      cardUid: 'MANUAL-OVERRIDE',
      result: TapResult.GRANTED,
      reason: reason ?? null,
      driverPublicId: null,
      plate: null,
      granted: true,
    });
    this.realtime.broadcastGateCommand(gate.id, { command: 'OPEN_GATE', tapEventId: event.id });

    this.logger.log(`[HARDWARE STUB] MANUAL OPEN gate=${gate.code} actor=${actorId} reason=${reason ?? 'n/a'}`);

    return { ok: true, eventId: event.id, gateCode: gate.code };
  }

  async setStatus(id: string, status: GateStatus, actorId?: string) {
    const gate = await this.byId(id);
    const updated = await this.prisma.gate.update({ where: { id: gate.id }, data: { status } });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'gate.status_changed',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Gate',
      targetId: gate.id,
      metadata: { from: gate.status, to: status },
    });
    return updated;
  }
}
