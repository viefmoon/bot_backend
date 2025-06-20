import { IsNotEmpty, IsString, IsOptional, IsEmail, IsNumber, IsBoolean, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

class LocalAddressDto {
  @IsNotEmpty()
  @IsString()
  id!: string;

  @IsNotEmpty()
  @IsString()
  street!: string;

  @IsNotEmpty()
  @IsString()
  number!: string;

  @IsOptional()
  @IsString()
  interiorNumber?: string | null;

  @IsOptional()
  @IsString()
  neighborhood?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsString()
  zipCode?: string | null;

  @IsOptional()
  @IsString()
  country?: string | null;

  @IsOptional()
  @IsString()
  references?: string | null;

  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  @IsBoolean()
  isDefault!: boolean;
}

export class SyncCustomerDto {
  @IsNotEmpty({ message: 'id is required' })
  @IsString({ message: 'id must be a string' })
  id!: string;

  @IsNotEmpty({ message: 'phoneNumber is required' })
  @IsString({ message: 'phoneNumber must be a string' })
  phoneNumber!: string;

  @IsOptional()
  @IsString({ message: 'firstName must be a string' })
  @Transform(({ value }) => value ?? null)
  firstName: string | null = null;

  @IsOptional()
  @IsString({ message: 'lastName must be a string' })
  @Transform(({ value }) => value ?? null)
  lastName: string | null = null;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email' })
  @Transform(({ value }) => value ?? null)
  email: string | null = null;

  @IsOptional()
  @Type(() => Date)
  @IsDateString()
  @Transform(({ value }) => value ?? null)
  birthDate: Date | null = null;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ?? 0)
  totalOrders: number = 0;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ?? 0)
  totalSpent: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value ?? true)
  isActive: boolean = true;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value ?? false)
  isBanned: boolean = false;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ?? null)
  banReason: string | null = null;

  @IsOptional()
  @Type(() => Date)
  @IsDateString()
  @Transform(({ value }) => value ?? new Date())
  updatedAt: Date = new Date();

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalAddressDto)
  addresses?: LocalAddressDto[];
}