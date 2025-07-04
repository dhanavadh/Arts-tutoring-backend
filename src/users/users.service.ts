// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DatabaseHealthService } from '../common/database-health.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private databaseHealthService: DatabaseHealthService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const userData = { ...createUserDto };

    // Set default profile image based on role if not provided
    if (!userData.profileImage) {
      switch (userData.role) {
        case UserRole.STUDENT:
          userData.profileImage =
            'https://artstutoring01.iconroof.co.th/student.png';
          break;
        case UserRole.TEACHER:
          userData.profileImage =
            'https://artstutoring01.iconroof.co.th/teacher.png';
          break;
        case UserRole.ADMIN:
          userData.profileImage =
            'https://artstutoring01.iconroof.co.th/admin.png';
          break;
      }
    }

    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [users, total] = await this.userRepository.findAndCount({
      relations: ['teacher', 'student'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      users: users.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: number): Promise<User> {
    const user = await this.databaseHealthService.executeWithRetry(async () => {
      return this.userRepository.findOne({
        where: { id },
        relations: ['teacher', 'student'],
      });
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.databaseHealthService.executeWithRetry(async () => {
      return this.userRepository.findOne({
        where: { email },
        relations: ['teacher', 'student'],
      });
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }

  async updatePassword(id: number, hashedPassword: string): Promise<void> {
    await this.userRepository.update(id, { password: hashedPassword });
  }

  async updateVerificationStatus(
    id: number,
    isVerified: boolean,
  ): Promise<void> {
    await this.userRepository.update(id, { isVerified });
  }

  async updateProfileImage(id: number, profileImage: string): Promise<User> {
    await this.userRepository.update(id, { profileImage });
    return this.findById(id);
  }

  async toggleUserStatus(id: number): Promise<User> {
    const user = await this.findById(id);
    user.isActive = !user.isActive;
    return this.userRepository.save(user);
  }

  async delete(id: number): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  async getUserStats() {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });
    const teachers = await this.userRepository.count({
      where: { role: UserRole.TEACHER },
    });
    const students = await this.userRepository.count({
      where: { role: UserRole.STUDENT },
    });
    const admins = await this.userRepository.count({
      where: { role: UserRole.ADMIN },
    });

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      teachers,
      students,
      admins,
    };
  }
}
