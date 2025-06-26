import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.createTransporter();
  }

  private createTransporter() {
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: smtpPort,
      secure: smtpPort === 465, // true for 465 (SSL), false for 587 (TLS)
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });

    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('Email service connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to email service', error);
    }
  }

  async sendOtpEmail(email: string, otp: string, firstName: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"Arts Tutoring" <${this.configService.get<string>('SMTP_FROM', 'contact@dhanav.me')}>`,
        to: email,
        subject: '[Arts Tutoring] Email Verification Code',
        html: this.getOtpEmailTemplate(otp, firstName),
        text: `Hello ${firstName},\n\nYour verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nArts Tutoring Team`,
        replyTo: this.configService.get<string>('SMTP_FROM', 'contact@dhanav.me'),
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent successfully to ${email}`);
      this.logger.log(`Message ID: ${result.messageId}`);
      this.logger.log(`Response: ${result.response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
      
      // For development/testing: Log OTP to console when email fails
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        this.logger.warn(`📧 EMAIL FAILED - OTP for ${email}: ${otp}`);
        this.logger.warn(`👤 User: ${firstName}`);
        this.logger.warn(`⏰ This OTP will expire in 10 minutes`);
        return true; // Return true so registration can continue
      }
      
      return false;
    }
  }

  private getOtpEmailTemplate(otp: string, firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background-color: #f9f9f9; }
          .otp-code { font-size: 32px; font-weight: bold; color: #007bff; text-align: center; 
                      padding: 20px; background-color: white; border: 2px dashed #007bff; 
                      margin: 20px 0; letter-spacing: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .warning { color: #dc3545; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Arts Tutoring</h1>
            <p>Account Verification</p>
          </div>
          <div class="content">
            <h2>Hello ${firstName},</h2>
            <p>Thank you for registering with Arts Tutoring! To complete your account verification, please use the OTP code below:</p>
            
            <div class="otp-code">${otp}</div>
            
            <p>This OTP code will expire in <strong>10 minutes</strong>.</p>
            
            <p class="warning">For security reasons, please do not share this code with anyone.</p>
            
            <p>If you didn't request this verification, please ignore this email.</p>
            
            <p>Best regards,<br>Arts Tutoring Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Arts Tutoring. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}