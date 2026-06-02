import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditCategory, UserRole } from '../common/enums';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';

export interface ListOptions {
  search?: string;
  skip?: number;
  take?: number;
  driverId?: string;
}

function normalizePlate(plate: string) {
  return plate.toUpperCase().replace(/\s+/g, '');
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(opts: ListOptions = {}) {
    const take = Math.min(100, Math.max(1, opts.take ?? 25));
    const skip = Math.max(0, opts.skip ?? 0);
    const search = (opts.search ?? '').trim();
    const where = {
      AND: [
        opts.driverId ? { driverId: opts.driverId } : {},
        search
          ? {
              OR: [
                { plate: { contains: normalizePlate(search) } },
                { driver: { fullName: { contains: search } } },
                { driver: { publicId: { contains: search.toUpperCase() } } },
              ],
            }
          : {},
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          driver: { select: { id: true, publicId: true, fullName: true } },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async create(dto: CreateVehicleDto, actorId?: string) {
    const plate = normalizePlate(dto.plate);
    if (await this.prisma.vehicle.findUnique({ where: { plate } })) {
      throw new ConflictException(`Vehicle ${plate} already exists`);
    }
    if (!(await this.prisma.driver.findUnique({ where: { id: dto.driverId } }))) {
      throw new NotFoundException('Driver not found');
    }
    const created = await this.prisma.vehicle.create({
      data: { plate, type: dto.type, driverId: dto.driverId },
    });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'vehicle.created',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Vehicle',
      targetId: created.id,
      metadata: { plate, type: dto.type, driverId: dto.driverId },
    });
    return created;
  }

  async update(id: string, dto: UpdateVehicleDto, actorId?: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Vehicle not found');
    if (dto.driverId) {
      if (!(await this.prisma.driver.findUnique({ where: { id: dto.driverId } }))) {
        throw new NotFoundException('Driver not found');
      }
    }
    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: {
        type: dto.type ?? undefined,
        active: dto.active ?? undefined,
        driverId: dto.driverId ?? undefined,
      },
    });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'vehicle.updated',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Vehicle',
      targetId: id,
      metadata: { changes: dto },
    });
    return updated;
  }
}
