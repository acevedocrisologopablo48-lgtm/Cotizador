import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

/**
 * Loguea cada request HTTP entrante con su método, ruta, status y duración.
 * No loguea cuerpos para evitar fugas de PII / secretos.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    const method = req.method;
    const url = req.originalUrl ?? req.url;
    const userId = (req as any).user?.id ?? 'anon';

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - startedAt;
          const status = res.statusCode;
          const line = `${method} ${url} ${status} ${ms}ms user=${userId}`;
          if (status >= 500) this.logger.error(line);
          else if (status >= 400) this.logger.warn(line);
          else this.logger.log(line);
        },
        error: (err) => {
          const ms = Date.now() - startedAt;
          const status = err?.status ?? 500;
          this.logger.error(
            `${method} ${url} ${status} ${ms}ms user=${userId} ERR=${err?.message ?? 'unknown'}`,
          );
        },
      }),
    );
  }
}
