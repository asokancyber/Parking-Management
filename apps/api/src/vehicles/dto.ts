import { IsString, MinLength, MaxLength, IsIn, IsOptional, IsBoolean } from 'class-validator';

export class CreateVehicleDto {
  @IsString() @MinLength(2) @MaxLength(20)
  plate!: string;

  @IsIn(['CAR', 'LORRY', 'VAN', 'MOTORCYCLE'])
  type!: 'CAR' | 'LORRY' | 'VAN' | 'MOTORCYCLE';

  @IsString()
  driverId!: string;
}

export class UpdateVehicleDto {
  @IsOptional() @IsIn(['CAR', 'LORRY', 'VAN', 'MOTORCYCLE'])
  type?: 'CAR' | 'LORRY' | 'VAN' | 'MOTORCYCLE';

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsString()
  driverId?: string;
}
