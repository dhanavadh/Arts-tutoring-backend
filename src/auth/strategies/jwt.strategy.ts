import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    console.log('🔧 JwtStrategy constructor called');
    const jwtSecret =
      configService.get<string>('JWT_SECRET') || 'your-super-secure-secret-key';
    console.log(
      '🔑 Using JWT secret from config:',
      jwtSecret.substring(0, 10) + '...',
    );

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        JwtStrategy.extractJwtFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
    console.log('✅ JwtStrategy initialized');
  }

  private static extractJwtFromCookie(req: Request): string | null {
    console.log('🍪 Extracting JWT from cookie');
    console.log('Cookies available:', req.cookies);
    if (
      req.cookies &&
      'access_token' in req.cookies &&
      req.cookies.access_token.length > 0
    ) {
      console.log('✅ JWT found in cookie');
      return req.cookies.access_token;
    }
    console.log('❌ No JWT in cookies');
    return null;
  }

  async validate(payload: any) {
    console.log('🔍 JwtStrategy.validate called with:', payload);
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      console.log('❌ User not found for ID:', payload.sub);
      throw new UnauthorizedException();
    }
    console.log('✅ User validated:', user.email);
    return user;
  }
}
