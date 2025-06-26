import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OtpService } from './otp.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { OtpType } from './entities/otp.entity';
import { UsersService } from '../users/users.service';

@Controller('otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
  ) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() verifyOtpDto: VerifyOtpDto) {
    await this.otpService.verifyOtp(verifyOtpDto.email, verifyOtpDto.otp, OtpType.REGISTRATION);
    return {
      success: true,
      message: 'OTP verified successfully',
    };
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  async resend(@Body() resendOtpDto: ResendOtpDto) {
    const user = await this.usersService.findByEmail(resendOtpDto.email);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }
    
    await this.otpService.generateOtp(resendOtpDto.email, user.firstName, OtpType.REGISTRATION);
    return {
      success: true,
      message: 'OTP sent successfully',
    };
  }
}