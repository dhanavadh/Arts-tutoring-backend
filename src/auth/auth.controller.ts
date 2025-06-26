import { Controller, Post, Body, UseGuards, Request, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyOtpDto } from '../otp/dto/verify-otp.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto);
    
    // Temporarily return the token in the response for testing
    console.log('🍪 Login successful for user:', result.user?.email);
    console.log('🍪 Access token length:', result.accessToken?.length);
    
    // Return user data WITH the token for frontend storage
    return {
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken, // Include token for frontend storage
      },
    };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(registerDto);
    
    // If user requires verification, don't set cookie
    if (result.requiresVerification) {
      return {
        success: true,
        message: result.message,
        requiresVerification: true,
        data: { user: result.user },
      };
    }

    // Set access token in httpOnly cookie for admin users
    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: undefined,
      path: '/',
    });

    // Return user data without the token
    const { accessToken, ...userResponse } = result;
    return {
      success: true,
      message: 'Registration successful',
      data: userResponse,
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: User,
  ) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token');
    return {
      success: true,
      message: 'Logout successful',
    };
  }

  @Post('verify-registration')
  @HttpCode(200)
  async verifyRegistration(@Body() verifyOtpDto: VerifyOtpDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.verifyRegistration(verifyOtpDto);
    
    // Set access token in httpOnly cookie
    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: undefined,
      path: '/',
    });

    // Return user data without the token
    const { accessToken, ...userResponse } = result;
    return {
      success: true,
      message: 'Account verified successfully',
      data: userResponse,
    };
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: User) {
    const { password, ...userProfile } = user;
    return { 
      success: true,
      data: { user: userProfile } 
    };
  }
}
