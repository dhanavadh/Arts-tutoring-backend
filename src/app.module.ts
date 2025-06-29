// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { databaseConfig } from './config/database.config';
import { DatabaseHealthService } from './common/database-health.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeachersModule } from './teachers/teachers.module';
import { StudentsModule } from './students/students.module';
import { BookingsModule } from './bookings/bookings.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { ArticlesModule } from './articles/articles.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminModule } from './admin/admin.module';
import { EmailModule } from './email/email.module';
import { OtpModule } from './otp/otp.module';
import { HealthModule } from './health/health.module';
import { ApiDocsModule } from './api-docs/api-docs.module';
import { CoursesModule } from './courses/courses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      ...databaseConfig,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      // Use the synchronize setting from databaseConfig to avoid schema sync issues
      migrationsRun: false, // Disable automatic migrations for now to avoid conflicts
    }),
    AuthModule,
    UsersModule,
    TeachersModule,
    StudentsModule,
    BookingsModule,
    QuizzesModule,
    ArticlesModule,
    UploadsModule,
    AdminModule,
    EmailModule,
    OtpModule,
    HealthModule,
    ApiDocsModule,
    CoursesModule,
  ],
  providers: [DatabaseHealthService],
  exports: [DatabaseHealthService],
})
export class AppModule {}
