import { IsString, IsOptional, IsNumber, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** Un pago por comensal (cuenta dividida). */
export class CloseOrderPaymentItemDto {
  @IsNumber()
  diner: number;

  @IsString()
  method: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class CloseOrderDto {
  @IsString()
  paymentMethod: string;

  /** Cuando la cuenta está dividida: método y monto por comensal. Obligatorio que impacte en cierre de caja por medio de pago. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloseOrderPaymentItemDto)
  payments?: CloseOrderPaymentItemDto[];


  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  invoiceType?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
