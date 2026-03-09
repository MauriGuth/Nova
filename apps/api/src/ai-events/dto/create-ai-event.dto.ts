import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateAIEventDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  relatedEntity?: string;

  @IsOptional()
  @IsString()
  relatedId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
