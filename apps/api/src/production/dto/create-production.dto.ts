import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateProductionDto {
  @IsString()
  recipeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0.01)
  plannedQty: number;

  @IsDateString()
  plannedDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
