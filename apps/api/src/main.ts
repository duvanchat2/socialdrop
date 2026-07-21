import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app/app.module';
import { SentryExceptionFilter } from './common/sentry-exception.filter.js';
import { mkdirSync } from 'fs';
import { join } from 'path';

// Sentry.init is a no-op if SENTRY_DSN is unset — safe with no tracker configured.
// GlitchTip is DSN/API-compatible with the Sentry SDK, so this works for either.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
});

async function bootstrap() {
  // Ensure uploads directory exists
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIRECTORY ?? 'uploads');
  mkdirSync(uploadDir, { recursive: true });

  // rawBody: true exposes req.rawBody (Buffer) on every request — needed to
  // verify the Meta webhook's X-Hub-Signature-256 HMAC against the exact
  // bytes Meta signed, not a re-serialized JSON body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useLogger(['log', 'error', 'warn', 'debug']);
  app.useGlobalFilters(new SentryExceptionFilter());

  // Security headers
  app.use(helmet());

  // Serve uploaded files as static assets so Instagram/TikTok can fetch them
  app.useStaticAssets(uploadDir, { prefix: '/uploads' });

  app.setGlobalPrefix('api');
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  app.enableCors({
    origin: (origin, callback) => {
      // Allow same-origin/no-origin requests (curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow configured frontend
      if (origin === frontendUrl) return callback(null, true);
      // Allow Chrome/Firefox extensions
      if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SocialDrop API')
    .setDescription('Social media scheduler API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3333;
  const appUrl = process.env.APP_URL ?? `http://localhost:${port}`;
  await app.listen(port);
  Logger.log(`🚀 API running on: http://localhost:${port}/api`);
  Logger.log(`📁 Static uploads: ${appUrl}/uploads/`);
  Logger.log(`📖 Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
