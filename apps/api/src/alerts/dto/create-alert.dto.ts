import { IsString, IsOptional } from 'class-validator';

export class CreateAlertDto {
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
