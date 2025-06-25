import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TeachersService } from '../teachers/teachers.service';
import { StudentsService } from '../students/students.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private teachersService: TeachersService,
    private studentsService: StudentsService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    // Get role-specific data
    let roleData: any = null;
    if (user.role === 'teacher') {
      try {
        roleData = await this.teachersService.findByUserId(user.id);
      } catch (error) {
        roleData = null;
      }
    } else if (user.role === 'student') {
      try {
        roleData = await this.studentsService.findByUserId(user.id);
      } catch (error) {
        roleData = null;
      }
    }

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profileImage: user.profileImage,
        roleData,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, role, ...roleSpecificData } =
      registerDto;

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      phone: registerDto.phone,
    };

    const user = await this.usersService.create(userData);

    // Create role-specific profile
    if (role === 'teacher') {
      await this.teachersService.create({
        userId: user.id,
        subject: roleSpecificData.subject || '',
        yearsExperience: roleSpecificData.experienceYears || 0,
        hourlyRate: roleSpecificData.hourlyRate,
        bio: roleSpecificData.bio,
        qualifications: roleSpecificData.qualifications ? [roleSpecificData.qualifications] : [],
      });
    } else if (role === 'student') {
      await this.studentsService.create({
        userId: user.id,
        gradeLevel: roleSpecificData.gradeLevel,
        school: roleSpecificData.school,
        parentEmail: roleSpecificData.parentEmail,
        parentPhone: roleSpecificData.parentPhone,
        learningGoals: roleSpecificData.learningGoals,
      });
    }

    // Generate access token for the new user
    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profileImage: user.profileImage,
      },
    };
  }

  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findById(userId);

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(userId, hashedNewPassword);

    return { message: 'Password changed successfully' };
  }
}
