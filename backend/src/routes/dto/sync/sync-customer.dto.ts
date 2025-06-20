import { IsNotEmpty, IsString, IsOptional, IsEmail, IsNumber } from 'class-validator';

export class SyncCustomerDto {
  @IsNotEmpty({ message: 'id is required' })
  @IsString({ message: 'id must be a string' })
  id!: string;

  @IsNotEmpty({ message: 'phoneNumber is required' })
  @IsString({ message: 'phoneNumber must be a string' })
  phoneNumber!: string;

  @IsOptional()
  @IsString({ message: 'firstName must be a string' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'lastName must be a string' })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string;

  @IsOptional()
  @IsNumber({}, { message: 'syncVersion must be a number' })
  syncVersion?: number;
}