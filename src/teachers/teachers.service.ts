import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from './entities/teacher.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private teacherRepository: Repository<Teacher>,
  ) {}

  async create(createTeacherDto: CreateTeacherDto): Promise<Teacher> {
    const teacher = this.teacherRepository.create(createTeacherDto as any);
    return this.teacherRepository.save(teacher) as any;
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [teachers, total] = await this.teacherRepository.findAndCount({
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      teachers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: number): Promise<Teacher> {
    const teacher = await this.teacherRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return teacher;
  }

  async findByUserId(userId: number): Promise<Teacher> {
    const teacher = await this.teacherRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    return teacher;
  }

  async findBySubject(subject: string, page: number = 1, limit: number = 10) {
    const [teachers, total] = await this.teacherRepository.findAndCount({
      where: { subject },
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { yearsExperience: 'DESC' },
    });

    return {
      teachers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(
    id: number,
    updateTeacherDto: UpdateTeacherDto,
  ): Promise<Teacher> {
    const teacher = await this.findById(id);
    Object.assign(teacher, updateTeacherDto);
    return this.teacherRepository.save(teacher);
  }

  async updateByUserId(
    userId: number,
    updateTeacherDto: UpdateTeacherDto,
  ): Promise<Teacher> {
    const teacher = await this.findByUserId(userId);
    Object.assign(teacher, updateTeacherDto);
    return this.teacherRepository.save(teacher);
  }

  async findOne(id: number): Promise<Teacher> {
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    return this.delete(id);
  }

  async delete(id: number): Promise<void> {
    const teacher = await this.findById(id);
    await this.teacherRepository.remove(teacher);
  }

  async getTeacherStats() {
    const totalTeachers = await this.teacherRepository.count();
    const averageExperience = await this.teacherRepository
      .createQueryBuilder('teacher')
      .select('AVG(teacher.yearsExperience)', 'avgExperience')
      .getRawOne();

    const subjectCounts = await this.teacherRepository
      .createQueryBuilder('teacher')
      .select('teacher.subject', 'subject')
      .addSelect('COUNT(*)', 'count')
      .groupBy('teacher.subject')
      .getRawMany();

    return {
      total: totalTeachers,
      averageExperience: parseFloat(averageExperience.avgExperience) || 0,
      subjectDistribution: subjectCounts,
    };
  }

  async searchTeachers(
    searchTerm: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const query = this.teacherRepository
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .where('teacher.subject LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orWhere('teacher.bio LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orWhere('user.firstName LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orWhere('user.lastName LIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orderBy('teacher.yearsExperience', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [teachers, total] = await query.getManyAndCount();

    return {
      teachers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
