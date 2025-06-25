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
}
