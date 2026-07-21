import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

/**
 * Reports every unhandled exception to Sentry/GlitchTip (with request path +
 * userId context) before formatting the same HTTP response Nest's default
 * filter would produce. Sentry.captureException is a no-op when SENTRY_DSN
 * isn't set, so this is safe with no tracker configured.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: { sub?: string } }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Client errors (4xx) are expected/handled — don't spam the tracker with
    // every 401/404/validation failure, only real server-side failures.
    if (!isHttpException || status >= 500) {
      Sentry.captureException(exception, {
        contexts: {
          request: { path: request.url, method: request.method },
        },
        user: request.user?.sub ? { id: request.user.sub } : undefined,
      });
    }

    const message = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    response.status(status).json(
      typeof message === 'string' ? { statusCode: status, message } : message,
    );
  }
}
