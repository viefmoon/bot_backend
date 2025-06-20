import { IsNotEmpty, IsString } from 'class-validator';

export class SetDefaultAddressDto {
  @IsNotEmpty({ message: 'whatsappPhoneNumber is required' })
  @IsString({ message: 'whatsappPhoneNumber must be a string' })
  whatsappPhoneNumber!: string;

  @IsNotEmpty({ message: 'otp is required' })
  @IsString({ message: 'otp must be a string' })
  otp!: string;
}