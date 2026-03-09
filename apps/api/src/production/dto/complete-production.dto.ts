import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CompleteProductionDto {
  @IsNumber()
  @Min(0)
  actualQty: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wasteQty?: number;

  @IsOptional()
  @IsString()
  wasteNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
