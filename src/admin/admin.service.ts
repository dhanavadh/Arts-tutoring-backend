import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Quiz } from '../quizzes/entities/quiz.entity';
import { Article, ArticleStatus } from '../articles/entities/article.entity';
import { UsersService } from '../users/users.service';
import { TeachersService } from '../teachers/teachers.service';
import { StudentsService } from '../students/students.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Quiz)
    private quizRepository: Repository<Quiz>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    private usersService: UsersService,
    private teachersService: TeachersService,
    private studentsService: StudentsService,
  ) {}

  async getDashboardStats() {
    const userStats = await this.usersService.getUserStats();
    const teacherStats = await this.teachersService.getTeacherStats();
    const studentStats = await this.studentsService.getStudentStats();

    // Booking statistics
    const totalBookings = await this.bookingRepository.count();
    const pendingBookings = await this.bookingRepository.count({
      where: { status: BookingStatus.PENDING },
    });
    const confirmedBookings = await this.bookingRepository.count({
      where: { status: BookingStatus.CONFIRMED },
    });
    const completedBookings = await this.bookingRepository.count({
      where: { status: BookingStatus.COMPLETED },
    });

    // Quiz statistics
    const totalQuizzes = await this.quizRepository.count();
    const activeQuizzes = await this.quizRepository.count({
      where: { isActive: true },
    });

    // Article statistics
    const totalArticles = await this.articleRepository.count();
    const publishedArticles = await this.articleRepository.count({
      where: { status: ArticleStatus.PUBLISHED },
    });

    // Recent activity
    const recentUsers = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['teacher', 'student'],
    });

    const recentBookings = await this.bookingRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['student', 'teacher', 'student.user', 'teacher.user'],
    });

    return {
      users: userStats,
      teachers: teacherStats,
      students: studentStats,
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
      },
      quizzes: {
        total: totalQuizzes,
        active: activeQuizzes,
      },
      articles: {
        total: totalArticles,
        published: publishedArticles,
      },
      recentActivity: {
        users: recentUsers.map((user) => {
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        }),
        bookings: recentBookings,
      },
    };
  }

  async getMonthlyStats() {
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    const monthlyUsers = await this.userRepository
      .createQueryBuilder('user')
      .select('DATE(user.createdAt) as date, COUNT(*) as count')
      .where('user.createdAt BETWEEN :start AND :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .groupBy('DATE(user.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    const monthlyBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('DATE(booking.createdAt) as date, COUNT(*) as count')
      .where('booking.createdAt BETWEEN :start AND :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .groupBy('DATE(booking.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      users: monthlyUsers,
      bookings: monthlyBookings,
    };
  }

  async getSystemHealth() {
    const dbConnection = this.userRepository.manager.connection.isConnected;

    // Check for any critical issues
    const inactiveUsers = await this.userRepository.count({
      where: { isActive: false },
    });

    const overdueBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.startTime < :now', { now: new Date() })
      .andWhere('booking.status = :status', { status: 'pending' })
      .getCount();

    return {
      database: dbConnection ? 'healthy' : 'error',
      inactiveUsers,
      overdueBookings,
      lastChecked: new Date().toISOString(),
    };
  }

  async getReports(type: string, startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    switch (type) {
      case 'bookings':
        return this.getBookingReport(start, end);
      case 'users':
        return this.getUserReport(start, end);
      case 'revenue':
        return this.getRevenueReport(start, end);
      default:
        return { error: 'Invalid report type' };
    }
  }

  private async getBookingReport(startDate: Date, endDate: Date) {
    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.student', 'student')
      .leftJoinAndSelect('booking.teacher', 'teacher')
      .leftJoinAndSelect('student.user', 'studentUser')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .where('booking.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .orderBy('booking.createdAt', 'DESC')
      .getMany();

    const statusCounts = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('booking.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('booking.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('booking.status')
      .getRawMany();

    return {
      bookings,
      summary: {
        total: bookings.length,
        statusBreakdown: statusCounts,
      },
    };
  }

  private async getUserReport(startDate: Date, endDate: Date) {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.teacher', 'teacher')
      .leftJoinAndSelect('user.student', 'student')
      .where('user.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    const roleCounts = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('user.role')
      .getRawMany();

    return {
      users: users.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }),
      summary: {
        total: users.length,
        roleBreakdown: roleCounts,
      },
    };
  }

  private async getRevenueReport(startDate: Date, endDate: Date) {
    // This would calculate revenue based on completed bookings and teacher rates
    const completedBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.teacher', 'teacher')
      .where('booking.status = :status', { status: 'completed' })
      .andWhere('booking.startTime BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .getMany();

    let totalRevenue = 0;
    const revenueByTeacher = {};

    completedBookings.forEach((booking) => {
      const duration =
        (booking.endTime.getTime() - booking.startTime.getTime()) /
        (1000 * 60 * 60); // hours
      const sessionRevenue = duration * (booking.teacher.hourlyRate || 0);
      totalRevenue += sessionRevenue;

      const teacherName = `${booking.teacher.user.firstName} ${booking.teacher.user.lastName}`;
      revenueByTeacher[teacherName] =
        (revenueByTeacher[teacherName] || 0) + sessionRevenue;
    });

    return {
      totalRevenue,
      completedSessions: completedBookings.length,
      revenueByTeacher,
      averageSessionValue:
        completedBookings.length > 0
          ? totalRevenue / completedBookings.length
          : 0,
    };
  }
}
