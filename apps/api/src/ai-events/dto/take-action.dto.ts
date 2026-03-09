import { IsString } from 'class-validator';

export class TakeActionDto {
  @IsString()
  actionTaken: string;
}
