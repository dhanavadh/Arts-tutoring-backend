import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuizAssignment } from './quiz-assignment.entity';

export enum AttemptStatus {
  STARTED = 'started',
  SUBMITTED = 'submitted',
  GRADED = 'graded',
}

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => QuizAssignment)
  @JoinColumn({ name: 'assignment_id' })
  quizAssignment: QuizAssignment;

  @Column({ name: 'assignment_id' })
  assignmentId: number;

  @Column({ name: 'student_id' })
  studentId: number;

  @Column({
    name: 'max_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  maxScore: number;

  @Column({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'submitted_at', nullable: true })
  submittedAt: Date;

  @Column({ type: 'json', nullable: true })
  answers: any;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number;

  @Column({ name: 'time_taken', nullable: true })
  timeTaken: number;

  @Column({ type: 'enum', enum: AttemptStatus, default: AttemptStatus.STARTED })
  status: AttemptStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
