import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Otp, OtpType } from './entities/otp.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(Otp)
    private otpRepository: Repository<Otp>,
    private emailService: EmailService,
  ) {}

  async generateOtp(email: string, firstName: string, type: OtpType = OtpType.REGISTRATION): Promise<boolean> {
    const otpCode = this.generateRandomOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    this.logger.log(`Generating OTP for ${email}: ${otpCode}, expires at: ${expiresAt}`);

    // Delete any existing OTP for this email and type
    await this.otpRepository.delete({ email, type });

    // Create new OTP record
    const otp = this.otpRepository.create({
      email,
      code: otpCode,
      type,
      expiresAt,
    });

    const savedOtp = await this.otpRepository.save(otp);
    this.logger.log(`OTP saved to database with ID: ${savedOtp.id}`);

    // Send OTP email
    const emailSent = await this.emailService.sendOtpEmail(email, otpCode, firstName);
    
    if (!emailSent) {
      // Clean up OTP record if email failed
      await this.otpRepository.delete(otp.id);
      this.logger.error(`Email failed, deleted OTP record for ${email}`);
      throw new BadRequestException('Failed to send OTP email');
    }

    this.logger.log(`OTP generated and sent to ${email}`);
    return true;
  }

  async verifyOtp(email: string, otpCode: string, type: OtpType = OtpType.REGISTRATION): Promise<boolean> {
    this.logger.log(`Verifying OTP for email: ${email}, code: ${otpCode}, type: ${type}`);
    
    const otp = await this.otpRepository.findOne({
      where: { email, type, isUsed: false },
    });

    this.logger.log(`Found OTP record:`, otp ? `Code: ${otp.code}, Expires: ${otp.expiresAt}, Attempts: ${otp.attempts}` : 'None');

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Check if OTP is expired
    if (new Date() > otp.expiresAt) {
      await this.otpRepository.delete(otp.id);
      throw new BadRequestException('OTP has expired');
    }

    // Increment attempts
    otp.attempts += 1;
    await this.otpRepository.save(otp);

    // Check max attempts (3 attempts allowed)
    if (otp.attempts > 3) {
      await this.otpRepository.delete(otp.id);
      throw new BadRequestException('Maximum OTP attempts exceeded. Please request a new OTP');
    }

    // Verify OTP code
    if (otp.code !== otpCode) {
      throw new BadRequestException('Invalid OTP code');
    }

    // Mark OTP as used
    otp.isUsed = true;
    await this.otpRepository.save(otp);

    this.logger.log(`OTP verified successfully for ${email}`);
    return true;
  }

  async cleanupExpiredOtps(): Promise<void> {
    await this.otpRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    this.logger.log('Expired OTPs cleaned up');
  }

  private generateRandomOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}