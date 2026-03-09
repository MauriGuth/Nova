import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTableDto {
  @IsString()
  locationId: string;

  @IsString()
  name: string;

  @IsString()
  zone: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  shape?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  scale?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  positionX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  positionY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
