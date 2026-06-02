import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TapListOptions {
  gateId?: string;
  driverId?: string;
  cardId?: string;
  cardUid?: string;
  result?: string;
  granted?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

@Injectable()
export class TapHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: TapListOptions = {}) {
    const take = Math.min(200, Math.max(1, opts.take ?? 50));
    const skip = Math.max(0, opts.skip ?? 0);

    const where: Record<string, unknown> = {};
    if (opts.gateId) where.gateId = opts.gateId;
    if (opts.driverId) where.driverId = opts.driverId;
    if (opts.cardId) where.cardId = opts.cardId;
    if (opts.cardUid) where.cardUid = opts.cardUid.toUpperCase().replace(/[^A-F0-9]/gi, '');
    if (opts.result) where.result = opts.result;
    if (opts.granted === true) where.result = 'GRANTED';
    if (opts.granted === false) where.result = { not: 'GRANTED' };
    if (opts.from || opts.to) {
      where.createdAt = {
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lte: opts.to } : {}),
      };
    }
    if (opts.search) {
      Object.assign(where, {
        OR: [
          { cardUid: { contains: opts.search.toUpperCase() } },
          { driver: { fullName: { contains: opts.search } } },
          { driver: { publicId: { contains: opts.search.toUpperCase() } } },
          { vehicle: { plate: { contains: opts.search.toUpperCase() } } },
        ],
      });
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cardTapEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          gate: { select: { code: true, name: true, direction: true } },
          driver: { select: { publicId: true, fullName: true } },
          vehicle: { select: { plate: true, type: true } },
          card: { select: { uid: true, label: true } },
        },
      }),
      this.prisma.cardTapEvent.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async summary(from?: Date) {
    const since = from ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.prisma.cardTapEvent.groupBy({
      by: ['result'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    let granted = 0;
    let denied = 0;
    for (const r of rows) {
      counts[r.result] = r._count._all;
      if (r.result === 'GRANTED') granted += r._count._all;
      else denied += r._count._all;
    }
    return { since: since.toISOString(), granted, denied, byResult: counts };
  }
}
