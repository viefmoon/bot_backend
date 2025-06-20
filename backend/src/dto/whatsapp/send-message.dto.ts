import { IsNotEmpty, IsString } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty({ message: 'to is required' })
  @IsString({ message: 'to must be a string' })
  to!: string;

  @IsNotEmpty({ message: 'message is required' })
  @IsString({ message: 'message must be a string' })
  message!: string;
}