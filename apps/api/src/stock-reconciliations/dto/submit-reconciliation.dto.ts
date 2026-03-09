import { IsString, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReconciliationItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0)
  countedQuantity: number;
}

export class SubmitReconciliationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReconciliationItemDto)
  items: ReconciliationItemDto[];
}
