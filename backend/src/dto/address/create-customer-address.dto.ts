import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateCustomerAddressDto {
  @IsNotEmpty({ message: 'street is required' })
  @IsString({ message: 'street must be a string' })
  street!: string;

  @IsNotEmpty({ message: 'number is required' })
  @IsString({ message: 'number must be a string' })
  number!: string;

  @IsOptional()
  @IsString({ message: 'interiorNumber must be a string' })
  interiorNumber?: string;

  @IsOptional()
  @IsString({ message: 'neighborhood must be a string' })
  neighborhood?: string;

  @IsNotEmpty({ message: 'city is required' })
  @IsString({ message: 'city must be a string' })
  city!: string;

  @IsNotEmpty({ message: 'state is required' })
  @IsString({ message: 'state must be a string' })
  state!: string;

  @IsOptional()
  @IsString({ message: 'zipCode must be a string' })
  zipCode?: string;

  @IsNotEmpty({ message: 'country is required' })
  @IsString({ message: 'country must be a string' })
  country!: string;

  @IsNotEmpty({ message: 'latitude is required' })
  @IsNumber({}, { message: 'latitude must be a number' })
  latitude!: number;

  @IsNotEmpty({ message: 'longitude is required' })
  @IsNumber({}, { message: 'longitude must be a number' })
  longitude!: number;

  @IsOptional()
  @IsString({ message: 'references must be a string' })
  references?: string;

  @IsOptional()
  @IsBoolean({ message: 'isDefault must be a boolean' })
  isDefault?: boolean;
}