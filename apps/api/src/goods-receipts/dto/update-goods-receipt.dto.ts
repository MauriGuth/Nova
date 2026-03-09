import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateGoodsReceiptDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receivedByName?: string;

  @IsOptional()
  @IsString()
  receivedBySignature?: string;
}
