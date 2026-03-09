import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  locationId: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(20)
  cuit: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
