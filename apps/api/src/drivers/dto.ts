import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, Matches } from 'class-validator';

export class CreateDriverDto {
  @IsString() @MinLength(2) @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  // Optional — when omitted, system generates a temp password and marks the
  // driver forceChangePassword=true. Always omitted by the admin onboarding
  // wizard; the legacy POST /drivers public path may supply one.
  @IsOptional() @IsString() @MinLength(8)
  password?: string;

  @IsString() @MinLength(2) @MaxLength(20)
  vehiclePlate!: string;

  @IsIn(['CAR', 'LORRY', 'VAN', 'MOTORCYCLE'])
  vehicleType!: 'CAR' | 'LORRY' | 'VAN' | 'MOTORCYCLE';

  @IsOptional() @IsString() @MaxLength(120)
  company?: string;
}

export class UpdateDriverDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  fullName?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @Matches(/^\+?\d{8,15}$/)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(120)
  company?: string;
}

export class ResetPasswordDto {
  // Operator note (audit trail). Optional.
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class LockAccountDto {
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}
