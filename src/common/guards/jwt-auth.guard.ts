import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    console.log('🔒 JwtAuthGuard.canActivate called');
    const request = context.switchToHttp().getRequest();
    console.log('🔍 Headers:', request.headers.authorization);
    console.log('🍪 Cookies:', request.cookies);
    
    const result = super.canActivate(context);
    console.log('🎯 canActivate result:', result);
    return result;
  }

  handleRequest(err: any, user: any, info: any) {
    console.log('🔍 JwtAuthGuard.handleRequest called');
    console.log('Error:', err);
    console.log('User:', user?.email);
    console.log('Info:', info);
    
    if (err || !user) {
      console.log('❌ Authentication failed');
      throw err || new UnauthorizedException();
    }
    console.log('✅ Authentication successful');
    return user;
  }
}
