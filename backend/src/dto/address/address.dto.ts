import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class AddressDto {
  @IsNotEmpty({ message: 'La calle es requerida' })
  @IsString()
  street!: string;

  @IsNotEmpty({ message: 'El número es requerido' })
  @IsString()
  number!: string;

  @IsOptional()
  @IsString()
  interiorNumber?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsNotEmpty({ message: 'La ciudad es requerida' })
  @IsString()
  city!: string;

  @IsNotEmpty({ message: 'El estado es requerido' })
  @IsString()
  state!: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsNotEmpty({ message: 'El país es requerido' })
  @IsString()
  country!: string;

  @IsNotEmpty({ message: 'La latitud es requerida' })
  @IsNumber()
  latitude!: number;

  @IsNotEmpty({ message: 'La longitud es requerida' })
  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsString()
  references?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}