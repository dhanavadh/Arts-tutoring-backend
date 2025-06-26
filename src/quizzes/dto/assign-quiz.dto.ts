import { IsNumber, IsArray, IsOptional, IsDateString } from 'class-validator';

export class AssignQuizDto {
  @IsOptional()
  @IsNumber()
  quizId?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  studentIds: number[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
