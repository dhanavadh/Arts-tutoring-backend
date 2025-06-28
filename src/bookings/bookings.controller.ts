import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { User } from '../users/entities/user.entity';
import { BookingStatus } from './entities/booking.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.create(createBookingDto, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(@Query() paginationDto: PaginationDto) {
    return this.bookingsService.findAll(
      paginationDto.page,
      paginationDto.limit,
    );
  }

  @Get('my-bookings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  findMyBookings(
    @CurrentUser() user: User,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.bookingsService.findByStudent(
      user.student.id,
      paginationDto.page,
      paginationDto.limit,
    );
  }

  @Get('my-schedule')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  findMySchedule(
    @CurrentUser() user: User,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.bookingsService.findByTeacher(
      user.teacher.id,
      paginationDto.page,
      paginationDto.limit,
    );
  }

  @Get('upcoming')
  findUpcoming(@CurrentUser() user: User) {
    return this.bookingsService.findUpcoming(user.id, user.role);
  }

  @Get('teacher/:teacherId/schedule')
  getTeacherSchedule(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query('date') date: string,
  ) {
    return this.bookingsService.getTeacherSchedule(teacherId, date);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: BookingStatus,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.updateStatus(id, status, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBookingDto: UpdateBookingDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.update(id, updateBookingDto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bookingsService.delete(id, user);
  }

  // Availability endpoints
  @Post('availability')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  createAvailability(
    @Body() createAvailabilityDto: CreateAvailabilityDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.createAvailability(createAvailabilityDto, user);
  }

  @Get('availability/teacher/:teacherId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  getTeacherAvailability(@Param('teacherId', ParseIntPipe) teacherId: number) {
    return this.bookingsService.getTeacherAvailability(teacherId);
  }

  @Get('availability/teacher/:teacherId/published')
  getPublishedAvailability(@Param('teacherId', ParseIntPipe) teacherId: number) {
    // Remove guards and roles so anyone can view published availability
    return this.bookingsService.getPublishedAvailability(teacherId);
  }

  @Get('teacher/:teacherId/slots')
  getAvailableTimeSlots(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query('date') date: string,
  ) {
    // Remove guards and roles so anyone can view available slots
    return this.bookingsService.getAvailableTimeSlots(teacherId, date);
  }

  @Patch('availability/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  updateAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAvailabilityDto: UpdateAvailabilityDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.updateAvailability(id, updateAvailabilityDto, user);
  }

  @Patch('availability/:id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  publishAvailability(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.publishAvailability(id, user);
  }

  @Patch('availability/:id/unpublish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  unpublishAvailability(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.unpublishAvailability(id, user);
  }

  @Delete('availability/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async deleteAvailability(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.deleteAvailability(id, user);
  }
}
