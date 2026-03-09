import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsOptional()
  @IsNumber()
  lastKnownCost?: number;

  @IsOptional()
  @IsString()
  priceStatus?: string; // ok | expensive | cheap

  @IsOptional()
  @IsString()
  notes?: string;
}
