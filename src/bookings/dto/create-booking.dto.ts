import { IsNumber, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsNumber()
  teacherId: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
