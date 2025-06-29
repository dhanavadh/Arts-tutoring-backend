import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { Course } from './entities/course.entity';
import { CourseEnrollment } from './entities/course-enrollment.entity';
import { UploadedImage } from './entities/uploaded-image.entity';
import { Teacher } from '../teachers/entities/teacher.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseEnrollment, UploadedImage, Teacher])],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}