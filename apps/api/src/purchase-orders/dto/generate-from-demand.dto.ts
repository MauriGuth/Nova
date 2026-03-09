import { IsString, IsOptional, IsArray } from 'class-validator';

export class GenerateFromDemandDto {
  @IsString()
  locationId: string;

  /** Si se envía, solo se incluyen estos productIds en la generación (filtro sobre demanda). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}
