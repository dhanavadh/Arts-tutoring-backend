// src/bookings/bookings.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Availability } from './entities/availability.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Availability)
    private availabilityRepository: Repository<Availability>,
    private studentsService: StudentsService,
    private teachersService: TeachersService,
  ) {}

  async create(
    createBookingDto: CreateBookingDto,
    user: User,
  ): Promise<Booking> {
    // Only students can create bookings
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can create bookings');
    }

    const { teacherId, startTime, endTime, subject, notes } = createBookingDto;

    // Validate booking time
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      throw new BadRequestException('End time must be after start time');
    }

    if (start < new Date()) {
      throw new BadRequestException('Cannot book in the past');
    }

    // Check if teacher exists and is available
    const teacher = await this.teachersService.findById(teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    // Check for conflicting bookings
    const conflictingBooking = await this.checkForConflicts(
      teacherId,
      start,
      end,
    );
    if (conflictingBooking) {
      throw new BadRequestException('Teacher is not available at this time');
    }

    // Get student profile
    const student = await this.studentsService.findByUserId(user.id);

    const booking = this.bookingRepository.create({
      studentId: student.id,
      teacherId,
      startTime: start,
      endTime: end,
      subject,
      notes,
      status: BookingStatus.PENDING,
    });

    return this.bookingRepository.save(booking);
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [bookings, total] = await this.bookingRepository.findAndCount({
      relations: ['student', 'teacher', 'student.user', 'teacher.user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      bookings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByStudent(studentId: number, page: number = 1, limit: number = 10) {
    const [bookings, total] = await this.bookingRepository.findAndCount({
      where: { studentId },
      relations: ['teacher', 'teacher.user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { startTime: 'ASC' },
    });

    return {
      bookings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByTeacher(teacherId: number, page: number = 1, limit: number = 10) {
    const [bookings, total] = await this.bookingRepository.findAndCount({
      where: { teacherId },
      relations: ['student', 'student.user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { startTime: 'ASC' },
    });

    return {
      bookings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findUpcoming(userId: number, userRole: UserRole) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    const whereCondition: any = {
      startTime: Between(tomorrow, nextWeek),
      status: BookingStatus.CONFIRMED,
    };

    if (userRole === UserRole.STUDENT) {
      const student = await this.studentsService.findByUserId(userId);
      whereCondition.studentId = student.id;
    } else if (userRole === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(userId);
      whereCondition.teacherId = teacher.id;
    }

    return this.bookingRepository.find({
      where: whereCondition,
      relations:
        userRole === UserRole.STUDENT
          ? ['teacher', 'teacher.user']
          : ['student', 'student.user'],
      order: { startTime: 'ASC' },
    });
  }

  async updateStatus(
    id: number,
    status: BookingStatus,
    user: User,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['student', 'teacher', 'student.user', 'teacher.user'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check permissions
    if (user.role === UserRole.STUDENT) {
      // Students can only cancel their own bookings
      if (booking.student.user.id !== user.id) {
        throw new ForbiddenException('You can only modify your own bookings');
      }
      if (status !== BookingStatus.CANCELLED) {
        throw new ForbiddenException('Students can only cancel bookings');
      }
    } else if (user.role === UserRole.TEACHER) {
      // Teachers can confirm/complete their bookings
      const teacher = await this.teachersService.findByUserId(user.id);
      if (booking.teacherId !== teacher.id) {
        throw new ForbiddenException('You can only modify your own bookings');
      }
    }
    // Admins can modify any booking

    booking.status = status;
    return this.bookingRepository.save(booking);
  }

  async update(
    id: number,
    updateBookingDto: UpdateBookingDto,
    user: User,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['student', 'student.user'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Only the student who created the booking can update it
    if (user.role === UserRole.STUDENT && booking.student.user.id !== user.id) {
      throw new ForbiddenException('You can only update your own bookings');
    }

    // Can only update pending bookings
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Can only update pending bookings');
    }

    Object.assign(booking, updateBookingDto);
    return this.bookingRepository.save(booking);
  }

  async delete(id: number, user: User): Promise<void> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['student', 'student.user'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Only admins or the student who created the booking can delete it
    if (user.role === UserRole.STUDENT && booking.student.user.id !== user.id) {
      throw new ForbiddenException('You can only delete your own bookings');
    }

    await this.bookingRepository.remove(booking);
  }

  private async checkForConflicts(
    teacherId: number,
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> {
    const conflictingBooking = await this.bookingRepository.findOne({
      where: {
        teacherId,
        status: BookingStatus.CONFIRMED,
        startTime: Between(startTime, endTime),
      },
    });

    return !!conflictingBooking;
  }

  async getTeacherSchedule(teacherId: number, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.bookingRepository.find({
      where: {
        teacherId,
        startTime: Between(startOfDay, endOfDay),
        status: BookingStatus.CONFIRMED,
      },
      relations: ['student', 'student.user'],
      order: { startTime: 'ASC' },
    });
  }

  // Availability management methods
  async createAvailability(
    createAvailabilityDto: CreateAvailabilityDto,
    user: User,
  ): Promise<Availability> {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only teachers and admins can create availability');
    }

    let teacherId: number;
    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teachersService.findByUserId(user.id);
      teacherId = teacher.id;
    } else {
      // Admin can create availability for any teacher
      if (!createAvailabilityDto.teacherId) {
        throw new BadRequestException('Teacher ID is required for admin users');
      }
      teacherId = createAvailabilityDto.teacherId;
    }

    const availability = this.availabilityRepository.create({
      teacherId,
      dayOfWeek: createAvailabilityDto.dayOfWeek,
      startTime: createAvailabilityDto.startTime,
      endTime: createAvailabilityDto.endTime,
      slotDuration: createAvailabilityDto.slotDuration,
      isPublished: createAvailabilityDto.isPublished || false,
      effectiveDate: new Date(createAvailabilityDto.effectiveDate),
      expiryDate: createAvailabilityDto.expiryDate ? new Date(createAvailabilityDto.expiryDate) : null,
    });

    return this.availabilityRepository.save(availability);
  }

  async getTeacherAvailability(teacherId: number): Promise<Availability[]> {
    return this.availabilityRepository.find({
      where: { teacherId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async getPublishedAvailability(teacherId: number): Promise<Availability[]> {
    return this.availabilityRepository.find({
      where: { 
        teacherId,
        isPublished: true,
        effectiveDate: Between(new Date(), new Date('2030-12-31')),
      },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async updateAvailability(
    id: number,
    updateAvailabilityDto: UpdateAvailabilityDto,
    user: User,
  ): Promise<Availability> {
    const availability = await this.availabilityRepository.findOne({
      where: { id },
      relations: ['teacher', 'teacher.user'],
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }
    if (!availability.teacher || !availability.teacher.user) {
      throw new NotFoundException('Availability teacher or user not found');
    }

    // Check permissions
    if (user.role === UserRole.TEACHER) {
      if (availability.teacher.user.id !== user.id) {
        throw new ForbiddenException('You can only modify your own availability');
      }
    }

    Object.assign(availability, updateAvailabilityDto);
    return this.availabilityRepository.save(availability);
  }

  async publishAvailability(id: number, user: User): Promise<Availability> {
    const availability = await this.availabilityRepository.findOne({
      where: { id },
      relations: ['teacher', 'teacher.user'],
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }
    if (!availability.teacher || !availability.teacher.user) {
      throw new NotFoundException('Availability teacher or user not found');
    }

    if (user.role === UserRole.TEACHER && availability.teacher.user.id !== user.id) {
      throw new ForbiddenException('You can only publish your own availability');
    }

    availability.isPublished = true;
    return this.availabilityRepository.save(availability);
  }

  async unpublishAvailability(id: number, user: User): Promise<Availability> {
    const availability = await this.availabilityRepository.findOne({
      where: { id },
      relations: ['teacher', 'teacher.user'],
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }
    if (!availability.teacher || !availability.teacher.user) {
      throw new NotFoundException('Availability teacher or user not found');
    }

    if (user.role === UserRole.TEACHER && availability.teacher.user.id !== user.id) {
      throw new ForbiddenException('You can only unpublish your own availability');
    }

    availability.isPublished = false;
    return this.availabilityRepository.save(availability);
  }

  async getAvailableTimeSlots(teacherId: number, date: string): Promise<Array<{
    startTime: Date;
    endTime: Date;
    duration: number;
    available: boolean;
  }>> {
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Get teacher's availability for this day of week
    const availability = await this.availabilityRepository.find({
      where: {
        teacherId,
        dayOfWeek,
        isPublished: true,
      },
    });

    if (!availability.length) {
      return [];
    }

    // Get existing bookings for this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await this.bookingRepository.find({
      where: {
        teacherId,
        startTime: Between(startOfDay, endOfDay),
        status: BookingStatus.CONFIRMED,
      },
    });

    // Generate time slots based on availability
    const slots: Array<{
      startTime: Date;
      endTime: Date;
      duration: number;
      available: boolean;
    }> = [];
    for (const avail of availability) {
      const startTime = this.parseTime(avail.startTime);
      const endTime = this.parseTime(avail.endTime);
      const duration = avail.slotDuration;

      let current = startTime;
      while (current + duration <= endTime) {
        const slotStart = new Date(targetDate);
        slotStart.setHours(Math.floor(current / 60), current % 60, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + duration);

        // Check if slot conflicts with existing booking
        const hasConflict = bookings.some(booking => 
          (booking.startTime < slotEnd && booking.endTime > slotStart)
        );

        if (!hasConflict && slotStart > new Date()) {
          slots.push({
            startTime: slotStart,
            endTime: slotEnd,
            duration,
            available: true,
          });
        }

        current += duration;
      }
    }

    return slots;
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async deleteAvailability(id: number, user: User): Promise<void> {
    const availability = await this.availabilityRepository.findOne({ where: { id } });
    if (!availability) {
      throw new NotFoundException('Availability not found');
    }
    // Only the teacher who owns the slot or an admin can delete
    if (
      user.role !== UserRole.ADMIN &&
      (!availability.teacherId || availability.teacherId !== user.id)
    ) {
      // If user is a teacher, check if they own the slot
      if (user.role === UserRole.TEACHER) {
        const teacher = await this.teachersService.findByUserId(user.id);
        if (!teacher || teacher.id !== availability.teacherId) {
          throw new ForbiddenException('You can only delete your own availability slots');
        }
      } else {
        throw new ForbiddenException('You do not have permission to delete this availability');
      }
    }
    await this.availabilityRepository.delete(id);
  }
}
