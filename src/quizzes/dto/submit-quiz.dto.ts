import { IsObject } from 'class-validator';

export class SubmitQuizDto {
  @IsObject()
  answers: Record<number, string>; // questionId -> answer
}
