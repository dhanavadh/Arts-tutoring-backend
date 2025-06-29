import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../uploads/multer.config';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PublishCourseDto } from './dto/publish-course.dto';
import { EnrollCourseDto } from './dto/enroll-course.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NoTransform } from '../common/decorators/no-transform.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {
    console.log('🎯 CoursesController initialized');
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  create(@Body() createCourseDto: CreateCourseDto, @Request() req) {
    console.log('🎯 CoursesController.create called');
    console.log('📊 Request user:', { id: req.user?.id, role: req.user?.role, hasTeacher: !!req.user?.teacher });
    console.log('📝 Course data:', createCourseDto);
    return this.coursesService.create(createCourseDto, req.user);
  }

  @Get()
  findAll() {
    console.log('🔍 CoursesController.findAll called');
    return this.coursesService.findAll();
  }

  @Get('published')
  findPublished() {
    return this.coursesService.findPublished();
  }

  @Get('my-courses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  findMyCourses(@Request() req) {
    return this.coursesService.findByTeacher(req.user.teacher?.id || req.user.id);
  }

  @Get('my-enrollments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  getMyEnrollments(@Request() req) {
    return this.coursesService.getStudentEnrollments(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(+id);
  }

  @Get(':id/enrollments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  getEnrollments(@Param('id') id: string, @Request() req) {
    return this.coursesService.getEnrollments(+id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto, @Request() req) {
    return this.coursesService.update(+id, updateCourseDto, req.user);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  publish(@Param('id') id: string, @Body() publishCourseDto: PublishCourseDto, @Request() req) {
    return this.coursesService.publish(+id, publishCourseDto, req.user);
  }

  @Post('enroll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  enroll(@Body() enrollCourseDto: EnrollCourseDto, @Request() req) {
    return this.coursesService.enroll(enrollCourseDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  remove(@Param('id') id: string, @Request() req) {
    return this.coursesService.remove(+id, req.user);
  }

  @Post(':id/upload-banner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('banner', multerConfig))
  async uploadBanner(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.coursesService.uploadBanner(+id, file, req.user);
  }

  @Post('upload-image')
  @NoTransform()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    console.log('📁 Upload image endpoint called');
    console.log('📁 File received:', file ? file.filename : 'No file');
    console.log('👤 User:', req.user ? req.user.id : 'No user');
    
    return this.coursesService.uploadImage(file, req.user);
  }
}