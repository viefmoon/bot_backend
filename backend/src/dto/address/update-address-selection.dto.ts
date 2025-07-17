import { IsNotEmpty, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAddressSelectionDto {
  @IsNotEmpty({ message: 'preOrderId is required' })
  @Type(() => Number)
  @IsInt({ message: 'preOrderId must be an integer' })
  preOrderId!: number;

  @IsNotEmpty({ message: 'addressId is required' })
  @IsString({ message: 'addressId must be a string' })
  addressId!: string;

  @IsNotEmpty({ message: 'customerId is required' })
  @IsString({ message: 'customerId must be a string' })
  customerId!: string;
}