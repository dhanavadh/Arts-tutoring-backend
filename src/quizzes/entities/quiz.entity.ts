import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuizQuestion } from './quiz-question.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';
import { User } from '../../users/entities/user.entity';
import { QuizAssignment } from './quiz-assignment.entity';

@Entity('quizzes')
export class Quiz {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'time_limit', nullable: true })
  timeLimit: number;

  @Column({ name: 'max_attempts', type: 'int', nullable: true, default: null })
  maxAttempts: number | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  })
  status: 'draft' | 'published' | 'archived';

  @Column({ name: 'teacher_id', type: 'int', nullable: true })
  teacherId: number | null;

  @ManyToOne(() => Teacher, { nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: Teacher;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @Column({ name: 'total_marks', default: 0 })
  totalMarks: number;

  @OneToMany(() => QuizAssignment, (assignment) => assignment.quiz, {
    eager: true,
    cascade: true,
    onDelete: 'CASCADE',
  })
  assignments: QuizAssignment[];

  @OneToMany(() => QuizQuestion, (question) => question.quiz, {
    eager: true,
    cascade: true,
    onDelete: 'CASCADE',
  })
  questions: QuizQuestion[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
