import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardsService, normalizeUid } from '../cards/cards.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuditService } from '../audit/audit.service';
import {
  AuditCategory,
  CardStatus,
  GateDirection,
  GateStatus,
  TapResult,
  UserRole,
} from '../common/enums';

export interface TapContext {
  gateAccessToken: string;
  cardUid: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface TapOutcome {
  result: TapResult;
  granted: boolean;
  reason?: string;
  gate?: { code: string; name: string; direction: GateDirection };
  driver?: { publicId: string; fullName: string };
  vehicle?: { plate: string; type: string };
  card?: { uid: string; label: string | null };
  expiresAt?: string;
}

@Injectable()
export class CardAccessService {
  private readonly logger = new Logger(CardAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly subs: SubscriptionsService,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  async tap(ctx: TapContext): Promise<TapOutcome> {
    // ── Step 0 — resolve the gate from its access token. A wrong/missing token
    //            never even gets a TapEvent — return DENIED_GATE_UNAUTHORIZED
    //            without touching the DB beyond the gate lookup. We still log
    //            it to AuditLog so brute-force attempts are traceable.
    const gate = ctx.gateAccessToken
      ? await this.prisma.gate.findUnique({ where: { accessToken: ctx.gateAccessToken } })
      : null;

    if (!gate) {
      await this.audit.log({
        category: AuditCategory.TAP,
        action: 'tap.unauthorized',
        ipAddress: ctx.ipAddress,
        metadata: { reason: 'invalid gate access token', uid: ctx.cardUid?.slice(0, 8) ?? null },
      });
      throw new UnauthorizedException('Invalid gate access token');
    }

    if (gate.status === GateStatus.OFFLINE) {
      return this.record(gate, {
        cardUid: ctx.cardUid,
        cardId: null,
        driverId: null,
        vehicleId: null,
        result: TapResult.DENIED_GATE_OFFLINE,
        reason: 'Gate is offline',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

    const uid = normalizeUid(ctx.cardUid ?? '');
    if (!uid) {
      return this.record(gate, {
        cardUid: ctx.cardUid ?? '',
        cardId: null,
        driverId: null,
        vehicleId: null,
        result: TapResult.ERROR,
        reason: 'Empty or invalid card UID',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

    // ── Step 1 — card lookup.
    const card = await this.prisma.card.findUnique({
      where: { uid },
      include: {
        driver: { include: { vehicles: { where: { active: true } } } },
      },
    });

    if (!card) {
      return this.record(gate, {
        cardUid: uid,
        cardId: null,
        driverId: null,
        vehicleId: null,
        result: TapResult.DENIED_CARD_UNKNOWN,
        reason: 'Card not found in system',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

    // ── Step 2 — card status checks.
    if (card.status === CardStatus.LOST) {
      return this.record(gate, {
        cardUid: uid,
        cardId: card.id,
        driverId: card.driverId,
        vehicleId: null,
        result: TapResult.DENIED_CARD_LOST,
        reason: 'Card has been reported lost',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }
    if (card.status === CardStatus.BLACKLISTED) {
      return this.record(gate, {
        cardUid: uid,
        cardId: card.id,
        driverId: card.driverId,
        vehicleId: null,
        result: TapResult.DENIED_CARD_BLACKLISTED,
        reason: 'Card is blacklisted',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }
    if (card.status !== CardStatus.ACTIVE) {
      return this.record(gate, {
        cardUid: uid,
        cardId: card.id,
        driverId: card.driverId,
        vehicleId: null,
        result: TapResult.DENIED_CARD_INACTIVE,
        reason: `Card status is ${card.status}`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }
    if (card.expiresAt && card.expiresAt.getTime() < Date.now()) {
      return this.record(gate, {
        cardUid: uid,
        cardId: card.id,
        driverId: card.driverId,
        vehicleId: null,
        result: TapResult.DENIED_CARD_EXPIRED,
        reason: 'Card expired',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }
    if (!card.driver) {
      return this.record(gate, {
        cardUid: uid,
        cardId: card.id,
        driverId: null,
        vehicleId: null,
        result: TapResult.DENIED_CARD_UNASSIGNED,
        reason: 'Card has no assigned driver',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

    // ── Step 3 — vehicle on file. (Required so we can record what entered.)
    if (card.driver.vehicles.length === 0) {
      return this.record(gate, {
        cardUid: uid,
        cardId: card.id,
        driverId: card.driver.id,
        vehicleId: null,
        result: TapResult.DENIED_VEHICLE_UNKNOWN,
        reason: 'Driver has no active vehicle on file',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }
    const vehicle = card.driver.vehicles[0];

    // ── Step 4 — subscription.
    const subCheck = await this.subs.checkForDriver(card.driver.id);
    if (!subCheck.ok) {
      const result =
        subCheck.reason === 'Subscription expired'
          ? TapResult.DENIED_SUBSCRIPTION_EXPIRED
          : subCheck.reason === 'Subscription suspended'
            ? TapResult.DENIED_SUBSCRIPTION_SUSPENDED
            : subCheck.reason === 'Driver blacklisted'
              ? TapResult.DENIED_SUBSCRIPTION_SUSPENDED
              : TapResult.DENIED_NO_SUBSCRIPTION;
      return this.record(gate, {
        cardUid: uid,
        cardId: card.id,
        driverId: card.driver.id,
        vehicleId: vehicle.id,
        result,
        reason: subCheck.reason ?? 'Subscription check failed',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

    // ── Step 5 — adjust occupancy.
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

    // ── Step 6 — hardware command. Replace this with an MQTT publish or HTTP
    //            POST to your ESP32 / relay controller. The audit log records
    //            the GRANTED *intent*; a confirmation handshake (see README
    //            hardening checklist) should gate that for prod.
    this.logger.log(
      `[HARDWARE STUB] OPEN_GATE gate=${gate.code} card=${uid} driver=${card.driver.publicId} vehicle=${vehicle.plate}`,
    );

    return this.record(gate, {
      cardUid: uid,
      cardId: card.id,
      driverId: card.driver.id,
      vehicleId: vehicle.id,
      result: TapResult.GRANTED,
      reason: 'OK',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      meta: {
        driverPublicId: card.driver.publicId,
        driverFullName: card.driver.fullName,
        plate: vehicle.plate,
        type: vehicle.type,
        cardUid: card.uid,
        cardLabel: card.label,
        expiresAt: subCheck.expiresAt?.toISOString(),
      },
    });
  }

  // Centralised recorder. Persists a CardTapEvent, writes an AuditLog,
  // broadcasts to admin realtime feed, and (for GRANTED) emits OPEN_GATE.
  private async record(
    gate: { id: string; code: string; name: string; direction: string },
    input: {
      cardUid: string;
      cardId: string | null;
      driverId: string | null;
      vehicleId: string | null;
      result: TapResult;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
      meta?: Record<string, unknown>;
    },
  ): Promise<TapOutcome> {
    const granted = input.result === TapResult.GRANTED;

    const event = await this.prisma.cardTapEvent.create({
      data: {
        gateId: gate.id,
        cardUid: input.cardUid,
        cardId: input.cardId,
        driverId: input.driverId,
        vehicleId: input.vehicleId,
        result: input.result,
        reason: input.reason ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
      select: { id: true, createdAt: true },
    });

    await this.audit.log({
      category: AuditCategory.TAP,
      action: granted ? 'gate.opened' : 'gate.denied',
      actorId: input.driverId,
      actorRole: input.driverId ? UserRole.DRIVER : null,
      targetType: 'Gate',
      targetId: gate.id,
      ipAddress: input.ipAddress,
      metadata: {
        result: input.result,
        reason: input.reason,
        cardUid: input.cardUid,
        ...input.meta,
      },
    });

    this.realtime.broadcastCardTap({
      id: event.id,
      at: event.createdAt.toISOString(),
      gateId: gate.id,
      gateCode: gate.code,
      cardUid: input.cardUid,
      result: input.result,
      reason: input.reason ?? null,
      driverPublicId: (input.meta?.driverPublicId as string | undefined) ?? null,
      plate: (input.meta?.plate as string | undefined) ?? null,
      granted,
    });

    if (granted) {
      this.realtime.broadcastGateCommand(gate.id, {
        command: 'OPEN_GATE',
        tapEventId: event.id,
        plate: input.meta?.plate as string | undefined,
      });
    }

    return {
      result: input.result,
      granted,
      reason: input.reason,
      gate: { code: gate.code, name: gate.name, direction: gate.direction as GateDirection },
      driver: input.meta?.driverPublicId
        ? {
            publicId: input.meta.driverPublicId as string,
            fullName: input.meta.driverFullName as string,
          }
        : undefined,
      vehicle: input.meta?.plate
        ? { plate: input.meta.plate as string, type: input.meta.type as string }
        : undefined,
      card: input.meta?.cardUid
        ? { uid: input.meta.cardUid as string, label: (input.meta.cardLabel as string | null) ?? null }
        : undefined,
      expiresAt: input.meta?.expiresAt as string | undefined,
    };
  }
}
