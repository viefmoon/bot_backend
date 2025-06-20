import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetAddressesQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: any }) => value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}