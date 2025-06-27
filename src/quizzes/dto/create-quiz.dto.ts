import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
  ESSAY = 'essay',
}

export class CreateQuestionDto {
  @IsString()
  question: string;

  @IsEnum(QuestionType)
  questionType: QuestionType;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  correctAnswerExplanation?: string;

  @IsNumber()
  @IsPositive()
  marks: number;
}

export class CreateQuizDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];

  @IsEnum(['draft', 'published', 'archived'])
  status: 'draft' | 'published' | 'archived' = 'draft';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  timeLimit?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxAttempts?: number = 1;
}
