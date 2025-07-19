import { IsNotEmpty } from 'class-validator';
import { BaseAddressDto } from './base-address.dto';

export class AddressDto extends BaseAddressDto {
  @IsNotEmpty({ message: 'El nombre de la dirección es requerido' })
  declare name: string;

  @IsNotEmpty({ message: 'La calle es requerida' })
  declare street: string;

  @IsNotEmpty({ message: 'El número es requerido' })
  declare number: string;

  @IsNotEmpty({ message: 'La ciudad es requerida' })
  declare city: string;

  @IsNotEmpty({ message: 'El estado es requerido' })
  declare state: string;

  @IsNotEmpty({ message: 'El país es requerido' })
  declare country: string;

  @IsNotEmpty({ message: 'La latitud es requerida' })
  declare latitude: number;

  @IsNotEmpty({ message: 'La longitud es requerida' })
  declare longitude: number;
}