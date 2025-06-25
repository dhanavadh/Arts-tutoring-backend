import { IsNumber, IsString, IsOptional, IsPositive } from 'class-validator';

export class CreateTeacherDto {
  @IsNumber()
  userId: number;

  @IsString()
  subject: string;

  @IsOptional()
  @IsNumber()
  yearsExperience?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  qualifications?: string[];

  @IsOptional()
  @IsString()
  availabilityStart?: string;

  @IsOptional()
  @IsString()
  availabilityEnd?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
