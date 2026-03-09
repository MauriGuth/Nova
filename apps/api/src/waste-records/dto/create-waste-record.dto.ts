import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWasteRecordDto {
  @IsString()
  locationId: string;

  @IsString()
  productId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
