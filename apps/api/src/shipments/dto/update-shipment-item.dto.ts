import { IsNumber, Min } from 'class-validator';

export class UpdateShipmentItemDto {
  @IsNumber()
  @Min(0)
  sentQty: number;
}
