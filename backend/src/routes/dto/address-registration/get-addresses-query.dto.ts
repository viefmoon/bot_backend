import { IsNotEmpty, IsString } from 'class-validator';

export class GetAddressesQueryDto {
  @IsNotEmpty({ message: 'otp is required' })
  @IsString({ message: 'otp must be a string' })
  otp!: string;
}