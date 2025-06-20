import { IsOptional, IsString, Transform } from 'class-validator';

export class GetAddressesQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includeInactive?: boolean;
}