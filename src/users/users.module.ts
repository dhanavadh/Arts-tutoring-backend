import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UploadsModule } from '../uploads/uploads.module';
import { DatabaseHealthService } from '../common/database-health.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UploadsModule],
  controllers: [UsersController],
  providers: [UsersService, DatabaseHealthService],
  exports: [UsersService],
})
export class UsersModule {}
