import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveShipmentItemDto {
  @IsString()
  itemId: string;

  @IsNumber()
  @Min(0)
  receivedQty: number;

  @IsOptional()
  @IsString()
  diffReason?: string;
}

export class ReceiveShipmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveShipmentItemDto)
  items: ReceiveShipmentItemDto[];

  @IsString()
  receivedByName: string;

  @IsString()
  receivedBySignature: string;

  @IsOptional()
  @IsString()
  receptionNotes?: string;
}
