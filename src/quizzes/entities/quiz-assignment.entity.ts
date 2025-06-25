import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import { Student } from '../../students/entities/student.entity';

export enum AssignmentStatus {
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
}

@Entity('quiz_assignments')
export class QuizAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Quiz)
  quiz: Quiz;

  @Column({ name: 'quiz_id' })
  quizId: number;

  @ManyToOne(() => Student)
  student: Student;

  @Column({ name: 'student_id' })
  studentId: number;

  @Column({ name: 'assigned_at' })
  assignedAt: Date;

  @Column({ name: 'due_date', nullable: true })
  dueDate: Date;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.ASSIGNED })
  status: AssignmentStatus;

  @Column({ default: 0 })
  attempts: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}