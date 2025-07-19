import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export abstract class BaseAddressDto {
  @IsString()
  name!: string;

  @IsString()
  street!: string;

  @IsString()
  number!: string;

  @IsOptional()
  @IsString()
  interiorNumber?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsString()
  country!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsString()
  deliveryInstructions?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}