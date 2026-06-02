import { Injectable, Logger } from '@nestjs/common';
import { AuditCategory, UserRole } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  category: AuditCategory;
  action: string;
  actorId?: string | null;
  actorRole?: UserRole | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export interface AuditListOptions {
  category?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          category: entry.category,
          action: entry.action,
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to persist audit log: ${(err as Error).message}`);
    }
  }

  async list(opts: AuditListOptions = {}) {
    const take = Math.min(200, Math.max(1, opts.take ?? 50));
    const skip = Math.max(0, opts.skip ?? 0);

    const where: Record<string, unknown> = {};
    if (opts.category) where.category = opts.category;
    if (opts.actorId) where.actorId = opts.actorId;
    if (opts.targetType) where.targetType = opts.targetType;
    if (opts.targetId) where.targetId = opts.targetId;
    if (opts.from || opts.to) {
      where.createdAt = {
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lte: opts.to } : {}),
      };
    }
    if (opts.search) {
      Object.assign(where, {
        OR: [
          { action: { contains: opts.search } },
          { metadata: { contains: opts.search } },
          { targetId: { contains: opts.search } },
        ],
      });
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.auditLog.count({ where }),
    ]);
    // Parse metadata JSON for convenience on the client.
    const decoded = items.map((row) => ({
      ...row,
      metadata: safeParse(row.metadata),
    }));
    return { items: decoded, total, skip, take };
  }

  async categoryStats() {
    const rows = await this.prisma.auditLog.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    return rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = r._count._all;
      return acc;
    }, {});
  }
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}
