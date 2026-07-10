import { Controller, Post, Body, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { Public } from './auth.public.js';
import { LoginDto } from './login.dto.js';
import { RegisterDto } from './register.dto.js';
import { VerifyEmailDto } from './verify-email.dto.js';
import { RequestPasswordResetDto } from './request-password-reset.dto.js';
import { ResetPasswordDto } from './reset-password.dto.js';

const SENSITIVE_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Register a new account and send a verification email' })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email + password, receive JWT' })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body.email, body.password);
    if (!result) throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);

    res.cookie('auth-token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      expires: new Date(result.expiresAt),
    });
    return result;
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with a single-use token' })
  async verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('request-password-reset')
  @ApiOperation({ summary: 'Request a password reset email (always returns 200)' })
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with a single-use token; invalidates prior sessions' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  /** Verify — requires valid token; just returns 200 if guard passes */
  @Post('verify')
  @ApiOperation({ summary: 'Verify a JWT token is still valid' })
  verify() {
    return { valid: true };
  }

  /** Logout — public; clears the auth cookie */
  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Logout — clears the auth cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('auth-token');
    return { ok: true };
  }
}
