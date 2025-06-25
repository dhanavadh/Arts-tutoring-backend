import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { UploadType } from '../entities/file-upload.entity';
import { PartialType } from '@nestjs/mapped-types';

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

  @IsNumber()
  uploadedById: number;

  @IsEnum(UploadType)
  uploadType: UploadType;

  @IsOptional()
  @IsNumber()
  entityId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUploadDto extends PartialType(CreateUploadDto) {}
