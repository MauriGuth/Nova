import { IsNumber, Min } from 'class-validator';

export class UpdatePurchaseOrderItemDto {
  @IsNumber()
  @Min(0)
  quantity: number;
}
