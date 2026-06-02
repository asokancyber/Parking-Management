import { IsString, IsOptional, MinLength, MaxLength, IsIn, IsISO8601 } from 'class-validator';
import { CardStatus } from '../common/enums';

const STATUS_VALUES = Object.values(CardStatus);

export class IssueCardDto {
  // Leave blank to auto-generate (e.g. PSC-001). Provide a hex UID when
  // issuing from a real RFID/NFC reader scan.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  uid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsString()
  driverId?: string; // omit to leave the card IN_STOCK

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AssignCardDto {
  @IsString()
  driverId!: string;
}

export class UpdateCardStatusDto {
  @IsIn(STATUS_VALUES)
  status!: CardStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReplaceCardDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  newUid!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  newLabel?: string;
}
