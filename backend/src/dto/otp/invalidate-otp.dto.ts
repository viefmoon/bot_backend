import { IsNotEmpty, IsString } from 'class-validator';

export class InvalidateOtpDto {
  @IsNotEmpty({ message: 'customerId is required' })
  @IsString({ message: 'customerId must be a string' })
  customerId!: string;
}