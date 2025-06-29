import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import { Student } from '../../students/entities/student.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';

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

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  quiz: Quiz;

  @Column({ name: 'quiz_id' })
  quizId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: number;

  @Column({ name: 'assigned_by' })
  assignedBy: number;

  // Temporarily disabled to avoid foreign key constraint issues
  // We'll handle teacher information through service layer lookups
  // @ManyToOne(() => Teacher, { nullable: true, eager: false })
  // @JoinColumn({ name: 'assigned_by' })
  // assignedByTeacher: Teacher;

  @Column({ name: 'assigned_at', type: 'datetime' })
  assignedAt: Date;

  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate: Date | null;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ASSIGNED,
  })
  status: AssignmentStatus;

  @Column({ default: 0 })
  attempts: number;

  // Note: QuizAttempts relationship - handled separately to avoid circular imports
  // Use the attempts column count for basic checks, load attempts via separate query if needed

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
