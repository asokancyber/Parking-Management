import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WhatsAppAdapter } from '../renewal/channels/whatsapp.adapter';
import { UserRole, AuditCategory, SubscriptionStatus } from '../common/enums';
import { generateTempPassword } from '../common/password';
import { CreateDriverDto, UpdateDriverDto } from './dto';

const idSuffix = customAlphabet('0123456789', 4);
const idTail = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ', 2);

export interface ListOptions {
  search?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);
  private readonly portalUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly whatsapp: WhatsAppAdapter,
    config: ConfigService,
  ) {
    this.portalUrl = config.get<string>('DRIVER_PORTAL_URL', 'http://localhost:3000/driver/login');
  }

  async list(opts: ListOptions = {}) {
    const take = Math.min(100, Math.max(1, opts.take ?? 25));
    const skip = Math.max(0, opts.skip ?? 0);
    const search = (opts.search ?? '').trim();

    const where = search
      ? {
          OR: [
            { fullName: { contains: search } },
            { publicId: { contains: search.toUpperCase() } },
            { phone: { contains: search } },
            { company: { contains: search } },
            { user: { email: { contains: search.toLowerCase() } } },
            { vehicles: { some: { plate: { contains: search.toUpperCase().replace(/\s+/g, '') } } } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { email: true, role: true } },
          vehicles: true,
          subscriptions: { orderBy: { expiresAt: 'desc' }, take: 1 },
          cards: { where: { status: { in: ['ACTIVE', 'SUSPENDED'] } } },
        },
      }),
      this.prisma.driver.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async findByUserId(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { vehicles: true, subscriptions: { orderBy: { expiresAt: 'desc' } } },
    });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  async findByPublicId(publicId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { publicId },
      include: { vehicles: true, subscriptions: { orderBy: { expiresAt: 'desc' } } },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  // Lookup by email — used by the onboarding wizard to detect "this email
  // is already an existing driver, offer to add the new vehicle to them".
  // Returns null (not 404) if missing so the caller can branch cleanly.
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        driver: {
          include: {
            vehicles: { select: { id: true, plate: true, type: true, active: true } },
            subscriptions: { orderBy: { expiresAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!user || !user.driver) return null;
    return {
      id: user.driver.id,
      publicId: user.driver.publicId,
      fullName: user.driver.fullName,
      email: user.email,
      phone: user.driver.phone,
      company: user.driver.company,
      vehicles: user.driver.vehicles,
      currentSubscription: user.driver.subscriptions[0] ?? null,
    };
  }

  async findDetail(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true, fullName: true, createdAt: true } },
        vehicles: { orderBy: { createdAt: 'desc' } },
        subscriptions: { orderBy: { expiresAt: 'desc' } },
        cards: { orderBy: { createdAt: 'desc' } },
        cardAssignments: {
          orderBy: { fromAt: 'desc' },
          take: 20,
          include: { card: { select: { uid: true, label: true } } },
        },
      },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const taps = await this.prisma.cardTapEvent.findMany({
      where: { driverId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { gate: { select: { code: true, name: true, direction: true } } },
    });
    return { ...driver, recentTaps: taps };
  }

  // Create driver + user + vehicle. When admin omits a password we generate
  // a temp, mark forceChangePassword=true, and WhatsApp the credentials.
  // The plaintext temp is returned ONCE in the response so the operator can
  // print it / re-share if WhatsApp delivery fails.
  async create(dto: CreateDriverDto, actorId?: string) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }
    if (await this.prisma.driver.findUnique({ where: { phone: dto.phone } })) {
      throw new ConflictException('Phone already registered');
    }
    const plate = dto.vehiclePlate.toUpperCase().replace(/\s+/g, '');
    if (await this.prisma.vehicle.findUnique({ where: { plate } })) {
      throw new ConflictException(`Vehicle ${plate} already registered`);
    }

    const usingGeneratedPassword = !dto.password;
    const plaintextPassword = dto.password ?? generateTempPassword();
    const passwordHash = await argon2.hash(plaintextPassword);
    const publicId = this.buildPublicId(dto.fullName);

    const created = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName,
        passwordHash,
        role: UserRole.DRIVER,
        driver: {
          create: {
            publicId,
            phone: dto.phone,
            fullName: dto.fullName,
            company: dto.company,
            forceChangePassword: usingGeneratedPassword,
            vehicles: { create: { plate, type: dto.vehicleType } },
          },
        },
      },
      include: { driver: { include: { vehicles: true } } },
    });

    await this.audit.log({
      category: AuditCategory.AUTH,
      action: 'driver.created',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: created.driver?.id,
      metadata: { email, publicId, plate, type: dto.vehicleType, generatedPassword: usingGeneratedPassword },
    });

    // Fire-and-forget the welcome WhatsApp. If the adapter is in dry-run
    // mode, the message gets logged but not delivered — the operator still
    // has the temp shown in the API response and can read it out manually.
    if (usingGeneratedPassword) {
      void this.sendWelcomeMessage(created.driver!.id, plate, plaintextPassword).catch((err) =>
        this.logger.warn(`Welcome WhatsApp failed for ${publicId}: ${(err as Error).message}`),
      );
    }

    return {
      ...created.driver!,
      // The temp password — caller MUST persist this on screen / print it /
      // hand it to the driver. We never store it in plaintext anywhere else.
      tempPassword: usingGeneratedPassword ? plaintextPassword : undefined,
      portalUrl: this.portalUrl,
    };
  }

  async update(id: string, dto: UpdateDriverDto, actorId?: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    if (dto.email && dto.email.toLowerCase() !== driver.user.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (dup) throw new ConflictException('Email already in use');
    }
    if (dto.phone && dto.phone !== driver.phone) {
      const dup = await this.prisma.driver.findUnique({ where: { phone: dto.phone } });
      if (dup) throw new ConflictException('Phone already in use');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.email || dto.fullName) {
        await tx.user.update({
          where: { id: driver.userId },
          data: {
            email: dto.email ? dto.email.toLowerCase() : undefined,
            fullName: dto.fullName ?? undefined,
          },
        });
      }
      return tx.driver.update({
        where: { id },
        data: {
          fullName: dto.fullName ?? undefined,
          phone: dto.phone ?? undefined,
          company: dto.company ?? undefined,
        },
      });
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'driver.updated',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: id,
      metadata: { changes: dto },
    });
    return updated;
  }

  async suspend(id: string, reason: string | undefined, actorId?: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { subscriptions: { orderBy: { expiresAt: 'desc' }, take: 1 } },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    const sub = driver.subscriptions[0];
    if (sub) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.SUSPENDED },
      });
    }
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'driver.suspended',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: id,
      metadata: { reason },
    });
    return { ok: true };
  }

  async reactivate(id: string, actorId?: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { subscriptions: { orderBy: { expiresAt: 'desc' }, take: 1 } },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    const sub = driver.subscriptions[0];
    if (sub && sub.status === SubscriptionStatus.SUSPENDED) {
      const stillValid = sub.expiresAt.getTime() > Date.now();
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: stillValid ? SubscriptionStatus.ACTIVE : SubscriptionStatus.EXPIRED },
      });
    }
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'driver.reactivated',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: id,
    });
    return { ok: true };
  }

  // ───────────────── Admin password / account actions ──────────────────

  // Reset: generate a fresh temp, hash it, mark forceChangePassword=true,
  // WhatsApp the driver. Returns the plaintext temp ONCE so the operator
  // can read it back if WhatsApp delivery fails. Never stored elsewhere.
  async resetPassword(id: string, reason: string | undefined, actorId?: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { user: true, vehicles: { take: 1 } },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const newTemp = generateTempPassword();
    const hash = await argon2.hash(newTemp);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: driver.userId }, data: { passwordHash: hash } });
      await tx.driver.update({
        where: { id },
        data: { forceChangePassword: true, passwordChangedAt: null },
      });
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'driver.password_reset',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: id,
      metadata: { reason: reason ?? null },
    });

    const plate = driver.vehicles[0]?.plate ?? driver.publicId;
    void this.sendResetMessage(driver.id, plate, newTemp).catch((err) =>
      this.logger.warn(`Reset WhatsApp failed for ${driver.publicId}: ${(err as Error).message}`),
    );

    return { tempPassword: newTemp, portalUrl: this.portalUrl };
  }

  async setForceChange(id: string, force: boolean, actorId?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');
    await this.prisma.driver.update({ where: { id }, data: { forceChangePassword: force } });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: force ? 'driver.force_change_set' : 'driver.force_change_cleared',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: id,
    });
    return { ok: true };
  }

  async lock(id: string, reason: string | undefined, actorId?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');
    await this.prisma.driver.update({
      where: { id },
      data: { lockedAt: new Date(), lockedReason: reason ?? null },
    });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'driver.locked',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: id,
      metadata: { reason },
    });
    return { ok: true };
  }

  // Lightweight resend: tells the driver where to log in + reminds them of
  // their username (plate). Does NOT touch the password (we don't store
  // plaintext) — for that, use resetPassword(). Useful when the driver lost
  // the original WhatsApp link but still knows their password.
  async resendCredentials(id: string, actorId?: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { vehicles: { take: 1 } },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    const plate = driver.vehicles[0]?.plate ?? driver.publicId;

    const body =
      `Hi ${driver.fullName.split(' ')[0]}, here are your ParkSphere login details.\n\n` +
      `Username: ${plate}\n` +
      `Login: ${this.portalUrl}\n\n` +
      (driver.forceChangePassword
        ? `You still have a temporary password from your initial onboarding. ` +
          `If you can't find it, please ask reception to reset it for you.`
        : `If you've forgotten your password, please ask reception to reset it.`);

    const r = await this.whatsapp.send({ toPhone: driver.phone, body });

    await this.audit.log({
      category: AuditCategory.AUTH,
      action: `driver.credentials_resent_${r.status.toLowerCase()}`,
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: id,
      metadata: { mode: r.mode, externalId: r.externalId, error: r.status === 'FAILED' ? r.error : undefined },
    });

    return {
      ok: r.status !== 'FAILED',
      mode: r.mode,
      status: r.status,
      portalUrl: this.portalUrl,
      plate,
    };
  }

  async unlock(id: string, actorId?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');
    await this.prisma.driver.update({
      where: { id },
      data: { lockedAt: null, lockedReason: null },
    });
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'driver.unlocked',
      actorId: actorId ?? null,
      actorRole: UserRole.ADMIN,
      targetType: 'Driver',
      targetId: id,
    });
    return { ok: true };
  }

  // ───────────────── Internal helpers ──────────────────

  private async sendWelcomeMessage(driverId: string, plate: string, tempPassword: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return;
    const body =
      `Welcome to ParkSphere Enterprise, ${driver.fullName.split(' ')[0]}.\n\n` +
      `Username: ${plate}\n` +
      `Temporary password: ${tempPassword}\n\n` +
      `Login: ${this.portalUrl}\n\n` +
      `Please log in and change your password immediately.`;
    const r = await this.whatsapp.send({ toPhone: driver.phone, body });
    await this.audit.log({
      category: AuditCategory.AUTH,
      action: `driver.welcome_${r.status.toLowerCase()}`,
      targetType: 'Driver',
      targetId: driverId,
      metadata: { mode: r.mode, externalId: r.externalId, error: r.status === 'FAILED' ? r.error : undefined },
    });
  }

  private async sendResetMessage(driverId: string, plate: string, tempPassword: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return;
    const body =
      `Hi ${driver.fullName.split(' ')[0]}, your ParkSphere password has been reset.\n\n` +
      `Username: ${plate}\n` +
      `New temporary password: ${tempPassword}\n\n` +
      `Login: ${this.portalUrl}\n\n` +
      `You will be required to set a new password on first login.`;
    const r = await this.whatsapp.send({ toPhone: driver.phone, body });
    await this.audit.log({
      category: AuditCategory.AUTH,
      action: `driver.reset_msg_${r.status.toLowerCase()}`,
      targetType: 'Driver',
      targetId: driverId,
      metadata: { mode: r.mode, externalId: r.externalId },
    });
  }

  private buildPublicId(fullName: string) {
    const prefix = fullName
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 4)
      .padEnd(4, 'X');
    return `${prefix}${idSuffix()}${idTail()}`;
  }
}
