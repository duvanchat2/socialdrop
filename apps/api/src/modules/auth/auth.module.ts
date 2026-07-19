import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@socialdrop/prisma';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { MAIL_PROVIDER } from './mail-provider.interface.js';
import { ConsoleMailProvider } from './console-mail.provider.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is required — set it in the environment before starting the API');
        }
        return {
          secret,
          signOptions: {
            // cast needed: newer @nestjs/jwt types expiresIn as StringValue (ms package)
            expiresIn: (config.get<string>('JWT_EXPIRY') ?? '7d') as never,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, { provide: MAIL_PROVIDER, useClass: ConsoleMailProvider }],
  exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
