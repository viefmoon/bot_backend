import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteAddressDto {
  @IsNotEmpty({ message: 'customerId is required' })
  @IsString({ message: 'customerId must be a string' })
  customerId!: string;
}