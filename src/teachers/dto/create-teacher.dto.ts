import { IsNumber, IsString, IsOptional, IsPositive, ValidateIf } from 'class-validator';

export class CreateTeacherDto {
  @IsNumber()
  userId: number;

  @IsString()
  subject: string;

  @IsOptional()
  @IsNumber()
  yearsExperience?: number;

  @IsOptional()
  @ValidateIf((o) => o.hourlyRate !== null && o.hourlyRate !== undefined && o.hourlyRate !== 0)
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
