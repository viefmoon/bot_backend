import { IsOptional, IsString, IsDateString } from 'class-validator';

export class SyncStatusQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'since must be a valid date string' })
  since?: string;

  @IsOptional()
  @IsString({ message: 'entityType must be a string' })
  entityType?: string;
}