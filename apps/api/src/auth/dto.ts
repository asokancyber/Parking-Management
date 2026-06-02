import { IsEmail, IsString, MinLength, IsOptional, IsIn, Matches } from 'class-validator';

export class RegisterDriverDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  vehiclePlate!: string;

  @IsIn(['CAR', 'LORRY', 'VAN', 'MOTORCYCLE'])
  vehicleType!: 'CAR' | 'LORRY' | 'VAN' | 'MOTORCYCLE';

  @IsOptional()
  @IsString()
  company?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
