import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Teacher } from '../../teachers/entities/teacher.entity';
import { CourseEnrollment } from './course-enrollment.entity';

export enum CourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum CourseLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ name: 'featured_image', nullable: true })
  featuredImage: string;

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.DRAFT })
  status: CourseStatus;

  @Column({ type: 'enum', enum: CourseLevel, default: CourseLevel.BEGINNER })
  level: CourseLevel;

  @Column()
  category: string;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ name: 'estimated_duration', nullable: true })
  estimatedDuration: number; // in hours

  @Column({ name: 'price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ name: 'max_enrollments', nullable: true })
  maxEnrollments: number;

  @Column({ name: 'enrollment_count', default: 0 })
  enrollmentCount: number;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ name: 'published_at', nullable: true })
  publishedAt: Date;

  @ManyToOne(() => Teacher, (teacher) => teacher.courses)
  @JoinColumn({ name: 'teacher_id' })
  teacher: Teacher;

  @Column({ name: 'teacher_id' })
  teacherId: number;

  @OneToMany(() => CourseEnrollment, (enrollment) => enrollment.course)
  enrollments: CourseEnrollment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}