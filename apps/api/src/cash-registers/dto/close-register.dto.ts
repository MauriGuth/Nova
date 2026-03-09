import { IsNumber, IsOptional, IsString, Min, IsObject } from 'class-validator';

/** Cantidad de billetes/monedas por denominación: { "10000": 2, "5000": 5, "1000": 20, ... } */
export type DenominationsMap = Record<string, number>;

export class CloseRegisterDto {
  /**
   * Conteo físico en efectivo (caja real).
   * Si se envía denominations, se ignora este valor y se calcula como suma de (denominación × cantidad).
   */
  @IsNumber()
  @Min(0)
  closingAmount: number;

  /** Conteo por denominación: clave = valor (ej. "10000"), valor = cantidad. Si viene, closingAmount se recalcula. */
  @IsOptional()
  @IsObject()
  denominations?: DenominationsMap;

  /** Total tarjetas declarado al cierre (débito + crédito) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  closingCardsTotal?: number;

  /** Total transferencias declarado al cierre */
  @IsOptional()
  @IsNumber()
  @Min(0)
  closingTransferTotal?: number;

  /** Total QR declarado al cierre */
  @IsOptional()
  @IsNumber()
  @Min(0)
  closingQrTotal?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Turno: 'morning' | 'afternoon' | 'night' */
  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salesNoTicket?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  internalConsumption?: number;

  @IsOptional()
  @IsString()
  closedBySignature?: string;
}
