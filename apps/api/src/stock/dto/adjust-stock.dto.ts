import {
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
} from 'class-validator';

export class AdjustStockDto {
  @IsString()
  productId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  quantity: number;

  @IsString()
  @MinLength(5)
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
