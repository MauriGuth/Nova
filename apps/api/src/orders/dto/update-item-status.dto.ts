import { IsString, IsOptional } from 'class-validator';

export class UpdateItemStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  preparedById?: string;
}
