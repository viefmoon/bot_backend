import { IsNotEmpty, IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDetailsDto } from './address-details.dto';

export class CreateAddressDto {
  @IsNotEmpty({ message: 'whatsappPhoneNumber is required' })
  @IsString({ message: 'whatsappPhoneNumber must be a string' })
  whatsappPhoneNumber!: string;

  @IsNotEmpty({ message: 'otp is required' })
  @IsString({ message: 'otp must be a string' })
  otp!: string;

  @IsNotEmpty({ message: 'address is required' })
  @IsObject({ message: 'address must be an object' })
  @ValidateNested()
  @Type(() => AddressDetailsDto)
  address!: AddressDetailsDto;
}