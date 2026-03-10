import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class AuditorChatDto {
  @IsString()
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsArray()
  history?: { role: 'user' | 'assistant'; content: string }[];
}
