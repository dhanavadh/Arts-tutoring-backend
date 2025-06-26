import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { ArticleStatus } from '../entities/article.entity';

export class CreateArticleDto {
  // teacherId is optional - it will be set by the service based on the authenticated user
  @IsOptional()
  @IsNumber()
  teacherId?: number;
  
  @IsString()
  title: string;

  // slug is optional - it will be auto-generated from title if not provided
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  featuredImage?: string;

  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  viewCount?: number;

  @IsOptional()
  @IsDateString()
  publishedAt?: Date;
}
