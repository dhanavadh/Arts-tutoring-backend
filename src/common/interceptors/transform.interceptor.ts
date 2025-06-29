import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';
import { NO_TRANSFORM_KEY } from '../decorators/no-transform.decorator';

export interface Response<T> {
  data: T;
  message?: string;
  timestamp: string;
  path: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T> | T>
{
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | T> {
    const request = context.switchToHttp().getRequest();

    const skipTransform = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    const noTransform = this.reflector.getAllAndOverride<boolean>(
      NO_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTransform || noTransform) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: any) => ({
        data,
        message: data?.message || 'Success',
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
