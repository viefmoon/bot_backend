import { IsString, IsNotEmpty } from 'class-validator';

export class ProcessAudioOrderDto {
  @IsString()
  @IsNotEmpty()
  transcription: string;
}