import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { SyncCustomerDto } from './sync-customer.dto';

export class BatchSyncCustomersDto {
  @IsArray({ message: 'customers must be an array' })
  @ArrayMinSize(1, { message: 'customers array must contain at least one customer' })
  @ValidateNested({ each: true })
  @Type(() => SyncCustomerDto)
  customers!: SyncCustomerDto[];
}