import { IsNumber, IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateStudentDto {
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsString()
  learningGoals?: string;
}
