import { IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  filename: string;

  @IsString()
  originalName: string;

  @IsString()
  mimetype: string;

  @IsNumber()
  size: number;

  @IsString()
  path: string;

  @IsString()
  uploadType: string;

  @IsOptional()
  @IsNumber()
  entityId?: number;
}