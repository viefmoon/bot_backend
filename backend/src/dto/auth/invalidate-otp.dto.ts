import { IsNotEmpty, IsString } from 'class-validator';

export class InvalidateOtpDto {
  @IsNotEmpty({ message: 'whatsappPhoneNumber is required' })
  @IsString({ message: 'whatsappPhoneNumber must be a string' })
  whatsappPhoneNumber!: string;
}