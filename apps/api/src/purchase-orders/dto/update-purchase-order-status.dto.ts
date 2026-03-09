import { IsString, IsOptional } from 'class-validator';

export class ReceivePurchaseOrderDto {
  @IsOptional()
  @IsString()
  goodsReceiptId?: string;
}

export class UpdatePurchaseOrderNotesDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
