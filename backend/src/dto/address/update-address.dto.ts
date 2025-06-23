import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'street must be a string' })
  street?: string;

  @IsOptional()
  @IsString({ message: 'number must be a string' })
  number?: string;

  @IsOptional()
  @IsString({ message: 'interiorNumber must be a string' })
  interiorNumber?: string;

  @IsOptional()
  @IsString({ message: 'neighborhood must be a string' })
  neighborhood?: string;

  @IsOptional()
  @IsString({ message: 'city must be a string' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'state must be a string' })
  state?: string;

  @IsOptional()
  @IsString({ message: 'zipCode must be a string' })
  zipCode?: string;

  @IsOptional()
  @IsString({ message: 'country must be a string' })
  country?: string;

  @IsOptional()
  @IsNumber({}, { message: 'latitude must be a number' })
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'longitude must be a number' })
  longitude?: number;

  @IsOptional()
  @IsString({ message: 'deliveryInstructions must be a string' })
  deliveryInstructions?: string;

  @IsOptional()
  @IsBoolean({ message: 'isDefault must be a boolean' })
  isDefault?: boolean;
}