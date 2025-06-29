import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsBoolean, Min, Max } from 'class-validator';
import { CourseLevel, CourseStatus } from '../entities/course.entity';

export class CreateCourseDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  featuredImage?: string;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @IsEnum(CourseLevel)
  level: CourseLevel;

  @IsString()
  category: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxEnrollments?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}