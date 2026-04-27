import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  // Ensure uploads directory exists
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIRECTORY ?? 'uploads');
  mkdirSync(uploadDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useLogger(['log', 'error', 'warn', 'debug']);

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
