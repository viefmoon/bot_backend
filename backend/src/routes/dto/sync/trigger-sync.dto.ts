import { IsOptional, IsString, IsIn } from 'class-validator';

export class TriggerSyncDto {
  @IsOptional()
  @IsString({ message: 'direction must be a string' })
  @IsIn(['local_to_cloud', 'cloud_to_local', 'bidirectional'], {
    message: 'direction must be one of: local_to_cloud, cloud_to_local, bidirectional'
  })
  direction?: 'local_to_cloud' | 'cloud_to_local' | 'bidirectional';

  @IsOptional()
  @IsString({ message: 'entityType must be a string' })
  @IsIn(['customer'], { message: 'entityType must be "customer"' })
  entityType?: string;
}