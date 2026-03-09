import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class MoveOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  itemIds: string[];

  @IsString()
  @IsNotEmpty()
  newTableId: string;
}
