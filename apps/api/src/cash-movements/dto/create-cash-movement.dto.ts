import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';

export class CreateCashMovementDto {
  @IsString()
  locationId: string;

  /** 'in' | 'out' | 'expense' | 'withdrawal' | 'extra_income' */
  @IsString()
  type: 'in' | 'out' | 'expense' | 'withdrawal' | 'extra_income';

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Caja abierta a la que se asocia (turno actual) */
  @IsOptional()
  @IsString()
  cashRegisterId?: string;
}
