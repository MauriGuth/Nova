import { IsString, IsOptional } from 'class-validator';

export class CreateReconciliationDto {
  @IsString()
  locationId: string;

  @IsOptional()
  @IsString()
  shiftLabel?: string;
}
