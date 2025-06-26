import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TeachersService } from '../teachers/teachers.service';
import { StudentsService } from '../students/students.service';
import { OtpService } from '../otp/otp.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from '../otp/dto/verify-otp.dto';
import { OtpType } from '../otp/entities/otp.entity';
import { UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private teachersService: TeachersService,
    private studentsService: StudentsService,
    private jwtService: JwtService,
    private otpService: OtpService,
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

    // Check if user is verified (only for teachers and students)
    if ((user.role === UserRole.TEACHER || user.role === UserRole.STUDENT) && !user.isVerified) {
      throw new UnauthorizedException('Please verify your account with the OTP sent to your email');
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

    // Create user (unverified for teachers and students)
    const userData = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      phone: registerDto.phone,
      isVerified: role === UserRole.ADMIN, // Only admin is verified by default
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

    // For teachers and students, send OTP for verification
    if (role === UserRole.TEACHER || role === UserRole.STUDENT) {
      await this.otpService.generateOtp(email, firstName, OtpType.REGISTRATION);
      
      return {
        success: true,
        message: 'Registration successful. Please check your email for OTP verification.',
        requiresVerification: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified,
        },
      };
    }

    // For admin, return token immediately
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
        isVerified: user.isVerified,
      },
    };
  }

  async verifyRegistration(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    // Verify OTP
    await this.otpService.verifyOtp(email, otp, OtpType.REGISTRATION);

    // Get user and mark as verified
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Update user verification status
    await this.usersService.updateVerificationStatus(user.id, true);

    // Generate access token
    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    // Get role-specific data
    let roleData: any = null;
    if (user.role === UserRole.TEACHER) {
      try {
        roleData = await this.teachersService.findByUserId(user.id);
      } catch (error) {
        roleData = null;
      }
    } else if (user.role === UserRole.STUDENT) {
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
        isVerified: true,
        roleData,
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
