import { IsOptional, IsInt, Min, IsBoolean, IsObject } from 'class-validator';

export class UpdateOrderSplitDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  customerCount?: number;

  @IsOptional()
  @IsBoolean()
  splitMode?: boolean;

  /** itemId (order item) or tempId (pending) → comensal number or { [comensal]: qty } */
  @IsOptional()
  @IsObject()
  itemPayer?: Record<string, number | Record<number, number>>;
}
