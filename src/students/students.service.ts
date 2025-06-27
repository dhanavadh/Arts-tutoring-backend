import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { DatabaseHealthService } from '../common/database-health.service';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    private databaseHealthService: DatabaseHealthService,
  ) {}

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    const student = this.studentRepository.create(createStudentDto);
    return this.studentRepository.save(student);
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [students, total] = await this.studentRepository.findAndCount({
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      students,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: number): Promise<Student> {
    const student = await this.databaseHealthService.executeWithRetry(async () => {
      return this.studentRepository.findOne({
        where: { id },
        relations: ['user'],
      });
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async findByUserId(userId: number): Promise<Student> {
    const student = await this.databaseHealthService.executeWithRetry(async () => {
      return this.studentRepository.findOne({
        where: { userId },
        relations: ['user'],
      });
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return student;
  }

  async findByGradeLevel(
    gradeLevel: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const [students, total] = await this.studentRepository.findAndCount({
      where: { schoolGrade: gradeLevel },
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      students,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(
    id: number,
    updateStudentDto: UpdateStudentDto,
  ): Promise<Student> {
    const student = await this.findById(id);
    Object.assign(student, updateStudentDto);
    return this.studentRepository.save(student);
  }

  async updateByUserId(
    userId: number,
    updateStudentDto: UpdateStudentDto,
  ): Promise<Student> {
    const student = await this.findByUserId(userId);
    Object.assign(student, updateStudentDto);
    return this.studentRepository.save(student);
  }

  async findOne(id: number): Promise<Student> {
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    return this.delete(id);
  }

  async delete(id: number): Promise<void> {
    const student = await this.findById(id);
    await this.studentRepository.remove(student);
  }

  async getStudentStats() {
    const totalStudents = await this.studentRepository.count();

    const gradeLevelCounts = await this.studentRepository
      .createQueryBuilder('student')
      .select('student.schoolGrade', 'schoolGrade')
      .addSelect('COUNT(*)', 'count')
      .where('student.schoolGrade IS NOT NULL')
      .groupBy('student.schoolGrade')
      .getRawMany();

    const schoolCounts = await this.studentRepository
      .createQueryBuilder('student')
      .select('student.schoolGrade', 'school')
      .addSelect('COUNT(*)', 'count')
      .where('student.schoolGrade IS NOT NULL')
      .groupBy('student.schoolGrade')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      total: totalStudents,
      schoolGradeDistribution: gradeLevelCounts,
      topSchools: schoolCounts,
    };
  }

  async searchStudents(
    searchTerm: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const query = this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .where('student.schoolGrade LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orWhere('student.schoolGrade LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orWhere('user.firstName LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orWhere('user.lastName LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orderBy('user.firstName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [students, total] = await query.getManyAndCount();

    return {
      students,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStudentsByTeacher(teacherId: number) {
    // Get students who have bookings with this teacher
    const students = await this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoin('student.bookings', 'booking')
      .where('booking.teacherId = :teacherId', { teacherId })
      .distinct(true)
      .getMany();

    return students;
  }
}
