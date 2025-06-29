import { IsEnum } from 'class-validator';
import { CourseStatus } from '../entities/course.entity';

export class PublishCourseDto {
  @IsEnum(CourseStatus)
  status: CourseStatus;
}