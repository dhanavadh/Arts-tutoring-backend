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
import { QuestionType } from './question-type.enum';

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Quiz, (quiz) => quiz.questions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ name: 'quiz_id' })
  quizId: number;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'enum', enum: QuestionType })
  questionType: QuestionType;

  @Column({ type: 'json', nullable: true })
  options: string[];

  @Column({ name: 'correct_answer', type: 'text', nullable: true })
  correctAnswer: string;

  @Column({ name: 'correct_answer_explanation', type: 'text', nullable: true })
  correctAnswerExplanation: string;

  @Column({ default: 1 })
  marks: number;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
