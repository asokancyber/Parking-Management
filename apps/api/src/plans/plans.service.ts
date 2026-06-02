import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditCategory, UserRole } from '../common/enums';

export interface PlanInput {
  name: string;
  priceCents: number;
  durationDays: number;
  description?: string;
  active?: boolean;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(includeInactive = false) {
    return this.prisma.plan.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ active: 'desc' }, { priceCents: 'asc' }],
    });
  }

  async byId(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(input: PlanInput, actorId?: string) {
    const dup = await this.prisma.plan.findUnique({ where: { name: input.name } });
    if (dup) throw new ConflictException(`A plan named "${input.name}" already exists`);
    const created = await this.prisma.plan.create({
      data: {
        name: input.name,
        priceCents: input.priceCents,
        durationDays: input.durationDays,
        description: input.description ?? null,
        active: input.active ?? true,
      },
    });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'plan.created',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Plan',
      targetId: created.id,
      metadata: { name: created.name, priceCents: created.priceCents, durationDays: created.durationDays },
    });
    return created;
  }

  async update(id: string, input: Partial<PlanInput>, actorId?: string) {
    const existing = await this.byId(id);
    if (input.name && input.name !== existing.name) {
      const dup = await this.prisma.plan.findUnique({ where: { name: input.name } });
      if (dup) throw new ConflictException(`A plan named "${input.name}" already exists`);
    }
    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        priceCents: input.priceCents ?? undefined,
        durationDays: input.durationDays ?? undefined,
        description: input.description ?? undefined,
        active: input.active ?? undefined,
      },
    });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'plan.updated',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Plan',
      targetId: id,
      metadata: { changes: input },
    });
    return updated;
  }
}
