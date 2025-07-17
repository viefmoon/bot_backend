import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SendAddressSelectionDto {
  @IsNotEmpty({ message: 'customerId is required' })
  @IsString({ message: 'customerId must be a string' })
  customerId!: string;

  @IsOptional()
  @IsString({ message: 'preOrderId must be a string' })
  preOrderId?: string;
}