import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CardStatus,
  AuditCategory,
  UserRole,
  CardAssignmentReason,
} from '../common/enums';
import { IssueCardDto, AssignCardDto, UpdateCardStatusDto, ReplaceCardDto } from './dto';

// Card UIDs are normalised to uppercase hex with no separators, so a tap
// reading "04:A2:1B:3C" matches an issued card stored as "04A21B3C".
// System-issued sequential cards use the PSC-NNN prefix (kept as-is, not
// stripped to hex, since they intentionally aren't hex).
export function normalizeUid(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.startsWith('PSC-')) return trimmed.replace(/\s+/g, '');
  return trimmed.replace(/[^a-fA-F0-9]/g, '');
}

// Sequence counter storage key. Lives in AppSetting as a JSON-encoded int.
const CARD_SEQ_KEY = 'cardSequence';
const CARD_PREFIX = 'PSC';
const CARD_PAD = 3; // PSC-001, PSC-002, ...

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.card.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { select: { publicId: true, fullName: true, phone: true } },
        replaces: { select: { id: true, uid: true } },
        replacedBy: { select: { id: true, uid: true } },
      },
    });
  }

  async byId(id: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: {
        driver: true,
        assignments: {
          orderBy: { fromAt: 'desc' },
          include: { driver: { select: { publicId: true, fullName: true } } },
        },
        replaces: { select: { id: true, uid: true, label: true } },
        replacedBy: { select: { id: true, uid: true, label: true } },
      },
    });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  async byUid(rawUid: string) {
    return this.prisma.card.findUnique({
      where: { uid: normalizeUid(rawUid) },
      include: { driver: true },
    });
  }

  async stats() {
    const [total, active, inStock, lost, blacklisted] = await this.prisma.$transaction([
      this.prisma.card.count(),
      this.prisma.card.count({ where: { status: CardStatus.ACTIVE } }),
      this.prisma.card.count({ where: { status: CardStatus.IN_STOCK } }),
      this.prisma.card.count({ where: { status: CardStatus.LOST } }),
      this.prisma.card.count({ where: { status: CardStatus.BLACKLISTED } }),
    ]);
    return { total, active, inStock, lost, blacklisted };
  }

  async issue(dto: IssueCardDto, actorId?: string) {
    // Operator may pass an empty / missing UID to mean "system, assign one".
    // We then auto-generate PSC-NNN using an atomic sequence so two concurrent
    // requests can't collide. If they pass a UID (e.g. scanned off real
    // hardware), we use that verbatim.
    let uid = normalizeUid(dto.uid ?? '');
    let autoLabel: string | null = null;
    if (!uid) {
      const next = await this.nextCardNumber();
      uid = this.formatCardId(next);
      autoLabel = `Driver Card #${String(next).padStart(CARD_PAD, '0')}`;
    }

    const dup = await this.prisma.card.findUnique({ where: { uid } });
    if (dup) throw new ConflictException(`A card with UID ${uid} already exists`);

    if (dto.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: dto.driverId } });
      if (!driver) throw new BadRequestException('Driver not found');
    }

    const card = await this.prisma.card.create({
      data: {
        uid,
        label: dto.label ?? autoLabel,
        notes: dto.notes ?? null,
        status: dto.driverId ? CardStatus.ACTIVE : CardStatus.IN_STOCK,
        driverId: dto.driverId ?? null,
        issuedAt: dto.driverId ? new Date() : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        assignments: dto.driverId
          ? {
              create: {
                driverId: dto.driverId,
                reason: CardAssignmentReason.INITIAL_ISSUE,
                actorId: actorId ?? null,
              },
            }
          : undefined,
      },
      include: { driver: true, assignments: true },
    });

    await this.audit.log({
      category: AuditCategory.CARD,
      action: 'card.issued',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Card',
      targetId: card.id,
      metadata: { uid, driverId: dto.driverId ?? null },
    });

    return card;
  }

  async assign(id: string, dto: AssignCardDto, actorId?: string) {
    const card = await this.byId(id);
    if (card.status === CardStatus.BLACKLISTED || card.status === CardStatus.RETIRED) {
      throw new BadRequestException(`Cannot assign a ${card.status} card`);
    }
    const driver = await this.prisma.driver.findUnique({ where: { id: dto.driverId } });
    if (!driver) throw new BadRequestException('Driver not found');

    const reason =
      card.driverId && card.driverId !== dto.driverId
        ? CardAssignmentReason.TRANSFER
        : CardAssignmentReason.INITIAL_ISSUE;

    // IMPORTANT: keep audit.log OUTSIDE the transaction. audit.log uses the
    // outer Prisma instance — on SQLite (single-writer) it deadlocks against
    // the open transaction and the 5s timeout fires.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.cardAssignment.updateMany({
        where: { cardId: card.id, toAt: null },
        data: { toAt: new Date() },
      });
      await tx.cardAssignment.create({
        data: {
          cardId: card.id,
          driverId: dto.driverId,
          reason,
          actorId: actorId ?? null,
        },
      });
      return tx.card.update({
        where: { id: card.id },
        data: {
          driverId: dto.driverId,
          status: CardStatus.ACTIVE,
          issuedAt: card.issuedAt ?? new Date(),
        },
      });
    });

    await this.audit.log({
      category: AuditCategory.CARD,
      action: 'card.assigned',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Card',
      targetId: card.id,
      metadata: { driverId: dto.driverId, reason },
    });
    return updated;
  }

  async setStatus(id: string, dto: UpdateCardStatusDto, actorId?: string) {
    const card = await this.byId(id);
    const next = dto.status;
    if (card.status === next) return card;

    const transitioning = transitionAction(card.status as CardStatus, next);
    if (!transitioning) {
      throw new BadRequestException(
        `Cannot transition card from ${card.status} to ${next}`,
      );
    }

    // See note in assign(): audit.log MUST live outside the transaction.
    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = { status: next };

      if (next === CardStatus.LOST || next === CardStatus.BLACKLISTED || next === CardStatus.RETIRED) {
        await tx.cardAssignment.updateMany({
          where: { cardId: card.id, toAt: null },
          data: { toAt: new Date() },
        });
        if (card.driverId) {
          await tx.cardAssignment.create({
            data: {
              cardId: card.id,
              driverId: null,
              reason:
                next === CardStatus.LOST
                  ? CardAssignmentReason.LOST
                  : next === CardStatus.BLACKLISTED
                    ? CardAssignmentReason.BLACKLIST
                    : CardAssignmentReason.RETURN,
              actorId: actorId ?? null,
            },
          });
        }
        data.driverId = null;
      }

      return tx.card.update({ where: { id: card.id }, data });
    });

    await this.audit.log({
      category: AuditCategory.CARD,
      action: `card.${transitioning}`,
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Card',
      targetId: card.id,
      metadata: { from: card.status, to: next, reason: dto.reason ?? null },
    });

    return updated;
  }

  // Issues a replacement card for an existing card. The old card is retired
  // and the new card inherits the driver assignment (subject to old card not
  // being blacklisted, which would defeat the purpose).
  async replace(id: string, dto: ReplaceCardDto, actorId?: string) {
    const old = await this.byId(id);
    if (old.status === CardStatus.BLACKLISTED) {
      throw new BadRequestException('Cannot replace a blacklisted card; issue a fresh one instead');
    }
    if (!old.driverId) {
      throw new BadRequestException('Cannot replace a card that has no assigned driver');
    }
    const newUid = normalizeUid(dto.newUid);
    if (!newUid) throw new BadRequestException('newUid must contain at least one hex character');

    const dup = await this.prisma.card.findUnique({ where: { uid: newUid } });
    if (dup) throw new ConflictException(`A card with UID ${newUid} already exists`);

    // See note in assign(): audit.log MUST live outside the transaction.
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.cardAssignment.updateMany({
        where: { cardId: old.id, toAt: null },
        data: { toAt: new Date() },
      });
      await tx.card.update({
        where: { id: old.id },
        data: { status: CardStatus.RETIRED, driverId: null },
      });
      return tx.card.create({
        data: {
          uid: newUid,
          label: dto.newLabel ?? old.label ?? null,
          status: CardStatus.ACTIVE,
          driverId: old.driverId,
          issuedAt: new Date(),
          replacesId: old.id,
          assignments: {
            create: {
              driverId: old.driverId,
              reason: CardAssignmentReason.REPLACEMENT,
              actorId: actorId ?? null,
            },
          },
        },
        include: { driver: true, assignments: true, replaces: { select: { id: true, uid: true } } },
      });
    });

    await this.audit.log({
      category: AuditCategory.CARD,
      action: 'card.replaced',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Card',
      targetId: old.id,
      metadata: { oldUid: old.uid, newUid, newCardId: created.id },
    });

    return created;
  }

  // Atomic increment of the card sequence counter. Stored in AppSetting as a
  // JSON int; the surrounding transaction serialises concurrent calls
  // (SQLite is single-writer anyway; on Postgres the row-level lock from the
  // upsert is enough). Self-healing: if the row is missing or non-numeric,
  // we fall back to (highest-existing-PSC + 1).
  private async nextCardNumber(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.appSetting.findUnique({ where: { key: CARD_SEQ_KEY } });
      let current = 0;
      if (row?.value) {
        try { current = JSON.parse(row.value); } catch { /* ignored */ }
      }
      if (!Number.isInteger(current) || current < 0) current = 0;

      // Self-heal: if the counter is somehow behind the highest existing
      // PSC-NNN in the DB, jump to that. Prevents conflicts after a manual
      // import or DB restore.
      const highest = await tx.card.findFirst({
        where: { uid: { startsWith: `${CARD_PREFIX}-` } },
        orderBy: { uid: 'desc' },
        select: { uid: true },
      });
      if (highest) {
        const m = /-(\d+)$/.exec(highest.uid);
        if (m) {
          const existing = Number(m[1]);
          if (existing >= current) current = existing;
        }
      }

      const next = current + 1;
      await tx.appSetting.upsert({
        where: { key: CARD_SEQ_KEY },
        create: { key: CARD_SEQ_KEY, value: JSON.stringify(next) },
        update: { value: JSON.stringify(next) },
      });
      return next;
    });
  }

  private formatCardId(n: number): string {
    return `${CARD_PREFIX}-${String(n).padStart(CARD_PAD, '0')}`;
  }
}

// Allowed status transitions, with the audit action name to record.
function transitionAction(from: CardStatus, to: CardStatus): string | null {
  const table: Record<CardStatus, Partial<Record<CardStatus, string>>> = {
    IN_STOCK:    { ACTIVE: 'activated', RETIRED: 'retired' },
    ACTIVE:      { SUSPENDED: 'suspended', LOST: 'reported_lost', BLACKLISTED: 'blacklisted', RETIRED: 'retired' },
    SUSPENDED:   { ACTIVE: 'reactivated', LOST: 'reported_lost', BLACKLISTED: 'blacklisted', RETIRED: 'retired' },
    LOST:        { BLACKLISTED: 'blacklisted', RETIRED: 'retired' },
    BLACKLISTED: { RETIRED: 'retired' },
    RETIRED:     {},
  };
  return table[from]?.[to] ?? null;
}
