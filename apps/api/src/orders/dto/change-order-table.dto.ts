import { IsString, IsNotEmpty } from 'class-validator';

export class ChangeOrderTableDto {
  @IsString()
  @IsNotEmpty()
  newTableId: string;
}
