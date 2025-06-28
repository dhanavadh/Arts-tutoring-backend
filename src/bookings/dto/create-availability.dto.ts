import { IsNumber, IsString, IsBoolean, IsOptional, IsDateString, Min, Max } from 'class-validator';

export class CreateAvailabilityDto {
  @IsNumber()
  @IsOptional()
  teacherId?: number;

  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsNumber()
  @Min(15)
  @Max(240)
  slotDuration: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsDateString()
  effectiveDate: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}