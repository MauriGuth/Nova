import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class OpenRegisterDto {
  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0)
  openingAmount: number;

  @IsOptional()
  @IsString()
  name?: string;

  /** Turno del día: 'morning' (mañana) | 'afternoon' (tarde) */
  @IsOptional()
  @IsString()
  shift?: string;
}
