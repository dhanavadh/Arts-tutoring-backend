import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { promises as fs } from 'fs';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseEnrollment, EnrollmentStatus } from './entities/course-enrollment.entity';
import { UploadedImage } from './entities/uploaded-image.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PublishCourseDto } from './dto/publish-course.dto';
import { EnrollCourseDto } from './dto/enroll-course.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { Teacher } from '../teachers/entities/teacher.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private enrollmentsRepository: Repository<CourseEnrollment>,
    @InjectRepository(UploadedImage)
    private uploadedImagesRepository: Repository<UploadedImage>,
    @InjectRepository(Teacher)
    private teachersRepository: Repository<Teacher>,
  ) {}

  async create(createCourseDto: CreateCourseDto, user: User): Promise<Course> {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only teachers and admins can create courses');
    }

    // Ensure user has a teacher record
    let teacher = user.teacher;
    
    if (!teacher && user.role === UserRole.TEACHER) {
      // Create a basic teacher record for the user
      teacher = this.teachersRepository.create({
        userId: user.id,
        subject: 'General', // Default subject
        hourlyRate: 0, // Default rate
        bio: '',
        yearsExperience: 0,
        isVerified: false,
      });
      teacher = await this.teachersRepository.save(teacher);
    }

    // For admin users, create a teacher record as well
    if (!teacher && user.role === UserRole.ADMIN) {
      teacher = this.teachersRepository.create({
        userId: user.id,
        subject: 'General', // Default subject
        hourlyRate: 0, // Default rate
        bio: '',
        yearsExperience: 0,
        isVerified: false,
      });
      teacher = await this.teachersRepository.save(teacher);
    }

    // Get teacher ID - use teacher record if available
    const teacherId = teacher?.id;

    if (!teacherId) {
      throw new BadRequestException('Unable to create teacher record');
    }

    const course = this.coursesRepository.create({
      ...createCourseDto,
      teacherId: teacherId,
      status: createCourseDto.status || CourseStatus.DRAFT,
    });

    const savedCourse = await this.coursesRepository.save(course);

    // Mark any images in the content as used
    if (createCourseDto.content) {
      await this.markImagesAsUsed(savedCourse.id, createCourseDto.content);
    }

    return savedCourse;
  }

  async findAll(): Promise<Course[]> {
    return this.coursesRepository.find({
      relations: ['teacher', 'teacher.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findPublished(): Promise<Course[]> {
    return this.coursesRepository.find({
      where: { status: CourseStatus.PUBLISHED },
      relations: ['teacher', 'teacher.user'],
      order: { publishedAt: 'DESC' },
    });
  }

  async findByTeacher(teacherId: number): Promise<Course[]> {
    return this.coursesRepository.find({
      where: { teacherId },
      relations: ['teacher', 'teacher.user', 'enrollments', 'enrollments.student', 'enrollments.student.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: ['teacher', 'teacher.user', 'enrollments', 'enrollments.student', 'enrollments.student.user'],
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Increment view count
    await this.coursesRepository.update(id, {
      viewCount: course.viewCount + 1,
    });

    return course;
  }

  async update(id: number, updateCourseDto: UpdateCourseDto, user: User): Promise<Course> {
    const course = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && course.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only update your own courses');
    }

    await this.coursesRepository.update(id, updateCourseDto);
    
    // Mark any images in the updated content as used
    if (updateCourseDto.content) {
      await this.markImagesAsUsed(id, updateCourseDto.content);
    }
    
    return this.findOne(id);
  }

  async publish(id: number, publishCourseDto: PublishCourseDto, user: User): Promise<Course> {
    const course = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && course.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only publish your own courses');
    }

    const updateData: any = { status: publishCourseDto.status };
    
    if (publishCourseDto.status === CourseStatus.PUBLISHED && !course.publishedAt) {
      updateData.publishedAt = new Date();
    }

    await this.coursesRepository.update(id, updateData);
    return this.findOne(id);
  }

  async enroll(enrollCourseDto: EnrollCourseDto, user: User): Promise<CourseEnrollment> {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can enroll in courses');
    }

    const course = await this.findOne(enrollCourseDto.courseId);

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException('Course is not available for enrollment');
    }

    // Check if student is already enrolled
    const existingEnrollment = await this.enrollmentsRepository.findOne({
      where: {
        courseId: enrollCourseDto.courseId,
        studentId: user.student.id,
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('You are already enrolled in this course');
    }

    // Check enrollment limit
    if (course.maxEnrollments && course.enrollmentCount >= course.maxEnrollments) {
      throw new BadRequestException('Course enrollment is full');
    }

    const enrollment = this.enrollmentsRepository.create({
      courseId: enrollCourseDto.courseId,
      studentId: user.student.id,
      enrolledAt: new Date(),
      notes: enrollCourseDto.notes,
    });

    const savedEnrollment = await this.enrollmentsRepository.save(enrollment);

    // Update enrollment count
    await this.coursesRepository.update(enrollCourseDto.courseId, {
      enrollmentCount: course.enrollmentCount + 1,
    });

    return savedEnrollment;
  }

  async getEnrollments(courseId: number, user: User): Promise<CourseEnrollment[]> {
    const course = await this.findOne(courseId);

    if (user.role !== UserRole.ADMIN && course.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only view enrollments for your own courses');
    }

    return this.enrollmentsRepository.find({
      where: { courseId },
      relations: ['student', 'student.user'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async getStudentEnrollments(user: User): Promise<CourseEnrollment[]> {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can view their enrollments');
    }

    return this.enrollmentsRepository.find({
      where: { studentId: user.student.id },
      relations: ['course', 'course.teacher', 'course.teacher.user'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async remove(id: number, user: User): Promise<void> {
    const course = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && course.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only delete your own courses');
    }

    // Clean up images associated with this course
    await this.cleanupCourseImages(id);

    await this.coursesRepository.delete(id);
  }

  async cleanupCourseImages(courseId: number): Promise<void> {
    const courseImages = await this.uploadedImagesRepository.find({
      where: { courseId },
    });

    for (const image of courseImages) {
      try {
        // Delete physical file
        await fs.unlink(image.filePath);
        // Delete database record
        await this.uploadedImagesRepository.remove(image);
        console.log(`Cleaned up course image: ${image.filename}`);
      } catch (error) {
        console.warn(`Failed to cleanup course image ${image.filename}:`, error);
      }
    }
  }

  async uploadBanner(id: number, file: Express.Multer.File, user: User): Promise<Course> {
    console.log('🖼️ Uploading banner for course:', id);
    console.log('📁 File details:', { filename: file?.filename, originalname: file?.originalname, size: file?.size });
    
    const course = await this.findOne(id);

    if (user.role !== UserRole.ADMIN && course.teacherId !== user.teacher?.id) {
      throw new ForbiddenException('You can only upload banners for your own courses');
    }

    if (!file || !file.filename) {
      throw new BadRequestException('No file uploaded or file not processed properly');
    }

    console.log('💾 Updating course with featuredImage:', file.filename);
    
    // Update course with the new banner path (filename is generated by multer)
    await this.coursesRepository.update(id, {
      featuredImage: file.filename,
    });

    const updatedCourse = await this.findOne(id);
    console.log('✅ Updated course featuredImage:', updatedCourse.featuredImage);
    
    return updatedCourse;
  }

  async uploadImage(file: Express.Multer.File, user: User): Promise<{ success: number; file: { url: string } }> {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only teachers and admins can upload images');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Create courses upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads', 'courses');
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    // Track the uploaded image in database
    const uploadedImage = this.uploadedImagesRepository.create({
      filename: file.filename,
      originalName: file.originalname,
      filePath: join(uploadDir, file.filename),
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedById: user.id,
      isUsed: false, // Will be marked as used when course is saved
    });

    await this.uploadedImagesRepository.save(uploadedImage);

    // Return the file URL in Editor.js expected format
    const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
    return {
      success: 1,
      file: {
        url: `${baseUrl}/uploads/courses/${file.filename}`,
      },
    };
  }

  async markImagesAsUsed(courseId: number, content: string): Promise<void> {
    if (!content) return;

    try {
      // Parse content to find image URLs
      const contentData = JSON.parse(content);
      if (contentData.blocks && Array.isArray(contentData.blocks)) {
        const imageUrls: string[] = [];
        
        contentData.blocks.forEach((block: any) => {
          if (block.type === 'image' && block.data?.file?.url) {
            imageUrls.push(block.data.file.url);
          }
        });

        // Extract filenames from URLs and mark as used
        for (const url of imageUrls) {
          const filename = url.split('/').pop();
          if (filename) {
            await this.uploadedImagesRepository.update(
              { filename, isUsed: false },
              { isUsed: true, courseId }
            );
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse content for image tracking:', error);
    }
  }

  async cleanupUnusedImages(): Promise<void> {
    // Find images older than 24 hours that are not used
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const unusedImages = await this.uploadedImagesRepository
      .createQueryBuilder('image')
      .where('image.isUsed = :isUsed', { isUsed: false })
      .andWhere('image.uploadedAt < :date', { date: oneDayAgo })
      .getMany();

    for (const image of unusedImages) {
      try {
        // Delete physical file
        await fs.unlink(image.filePath);
        // Delete database record
        await this.uploadedImagesRepository.remove(image);
        console.log(`Cleaned up unused image: ${image.filename}`);
      } catch (error) {
        console.warn(`Failed to cleanup image ${image.filename}:`, error);
      }
    }
  }
}