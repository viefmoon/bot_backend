import { IsNotEmpty, IsString, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from './address.dto';

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
  @Type(() => AddressDto)
  address!: AddressDto;
  
  @IsOptional()
  @IsString({ message: 'preOrderId must be a string' })
  preOrderId?: string;
}