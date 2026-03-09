import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateLevelDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQuantity?: number;
}
