import { IsNumber, IsOptional, IsString } from 'class-validator';

export class EnrollCourseDto {
  @IsNumber()
  courseId: number;

  @IsOptional()
  @IsString()
  notes?: string;
}