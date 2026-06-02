import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { customAlphabet } from 'nanoid';
import { UserRole, AuditCategory } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RegisterDriverDto, LoginDto } from './dto';
import { validatePassword } from '../common/password';

const idSuffix = customAlphabet('0123456789', 4);
const idTail = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ', 2);

function normalizePlate(plate: string) {
  return plate.toUpperCase().replace(/\s+/g, '');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async registerDriver(dto: RegisterDriverDto, ip?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const phoneTaken = await this.prisma.driver.findUnique({ where: { phone: dto.phone } });
    if (phoneTaken) throw new ConflictException('Phone already registered');

    const passwordHash = await argon2.hash(dto.password);
    const publicId = this.buildPublicId(dto.fullName);

    const created = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
        role: UserRole.DRIVER,
        driver: {
          create: {
            publicId,
            phone: dto.phone,
            fullName: dto.fullName,
            company: dto.company,
            vehicles: {
              create: {
                plate: normalizePlate(dto.vehiclePlate),
                type: dto.vehicleType,
              },
            },
          },
        },
      },
      include: { driver: { include: { vehicles: true } } },
    });

    await this.audit.log({
      category: AuditCategory.AUTH,
      action: 'driver.registered',
      actorId: created.id,
      actorRole: UserRole.DRIVER,
      targetType: 'Driver',
      targetId: created.driver?.id,
      ipAddress: ip,
    });

    return {
      driverId: created.driver?.publicId,
      userId: created.id,
      token: this.signToken(created.id, UserRole.DRIVER),
    };
  }

  // Admin / operator login by email.
  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { driver: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.driver?.lockedAt) {
      throw new ForbiddenException('Account is locked. Contact reception.');
    }

    const role = user.role as UserRole;

    await this.audit.log({
      category: AuditCategory.AUTH,
      action: 'user.login',
      actorId: user.id,
      actorRole: role,
      ipAddress: ip,
    });

    return {
      token: this.signToken(user.id, role),
      user: {
        id: user.id,
        email: user.email,
        role,
        fullName: user.fullName,
        driverPublicId: user.driver?.publicId ?? null,
        forceChangePassword: user.driver?.forceChangePassword ?? false,
      },
    };
  }

  // Driver portal login by vehicle plate + password. Lookup driver by their
  // vehicle's plate (case-insensitive, whitespace-stripped), then verify
  // password against the linked User.
  async loginByPlate(plate: string, password: string, ip?: string) {
    const normalized = normalizePlate(plate);
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { plate: normalized },
      include: { driver: { include: { user: true } } },
    });
    if (!vehicle || !vehicle.driver) {
      // Same message either way — don't leak which plates are registered.
      throw new UnauthorizedException('Invalid plate or password');
    }
    const driver = vehicle.driver;
    const user = driver.user;
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid plate or password');
    }
    if (driver.lockedAt) {
      throw new ForbiddenException(`Account locked${driver.lockedReason ? `: ${driver.lockedReason}` : ''}. Contact reception.`);
    }

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      category: AuditCategory.AUTH,
      action: 'driver.portal_login',
      actorId: user.id,
      actorRole: UserRole.DRIVER,
      targetType: 'Driver',
      targetId: driver.id,
      ipAddress: ip,
      metadata: { plate: normalized },
    });

    return {
      token: this.signToken(user.id, UserRole.DRIVER),
      user: {
        id: user.id,
        email: user.email,
        role: UserRole.DRIVER,
        fullName: user.fullName,
        driverPublicId: driver.publicId,
        forceChangePassword: driver.forceChangePassword,
        plate: normalized,
      },
    };
  }

  // Driver self-service password change. Requires current password.
  async changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });
    if (!user) throw new UnauthorizedException('Not authorised');

    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const validationError = validatePassword(newPassword);
    if (validationError) throw new BadRequestException(validationError);

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newHash = await argon2.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
      if (user.driver) {
        await tx.driver.update({
          where: { id: user.driver.id },
          data: { forceChangePassword: false, passwordChangedAt: new Date() },
        });
      }
    });

    await this.audit.log({
      category: AuditCategory.AUTH,
      action: 'password.changed',
      actorId: userId,
      actorRole: user.role as UserRole,
      ipAddress: ip,
    });

    return { ok: true };
  }

  // /auth/me — driver's own current profile + state flags. Used by the
  // driver portal layout to decide where to send them.
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: {
          include: {
            vehicles: true,
            subscriptions: { orderBy: { expiresAt: 'desc' }, take: 1 },
            cards: { where: { status: { in: ['ACTIVE', 'SUSPENDED', 'LOST'] } } },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      driver: user.driver
        ? {
            id: user.driver.id,
            publicId: user.driver.publicId,
            phone: user.driver.phone,
            company: user.driver.company,
            forceChangePassword: user.driver.forceChangePassword,
            lockedAt: user.driver.lockedAt,
            lastLoginAt: user.driver.lastLoginAt,
            passwordChangedAt: user.driver.passwordChangedAt,
            vehicles: user.driver.vehicles,
            subscriptions: user.driver.subscriptions,
            cards: user.driver.cards,
          }
        : null,
    };
  }

  private signToken(userId: string, role: UserRole) {
    return this.jwt.sign({ sub: userId, role });
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
