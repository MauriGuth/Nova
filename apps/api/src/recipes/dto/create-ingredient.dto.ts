import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0)
  qtyPerYield: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
