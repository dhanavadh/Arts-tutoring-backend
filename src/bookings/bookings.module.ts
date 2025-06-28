import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './entities/booking.entity';
import { Availability } from './entities/availability.entity';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Availability]),
    StudentsModule,
    TeachersModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
