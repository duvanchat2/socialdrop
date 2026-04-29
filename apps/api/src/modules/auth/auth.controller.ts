import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Public } from './auth.public.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Login — public endpoint, no token required */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with app password, receive JWT' })
  login(@Body() body: { password: string }) {
    if (!body?.password) {
      throw new HttpException('password is required', HttpStatus.BAD_REQUEST);
    }
    const result = this.authService.login(body.password);
    if (!result) throw new HttpException('Contraseña incorrecta', HttpStatus.UNAUTHORIZED);
    return result;
  }

  /** Verify — requires valid token; just returns 200 if guard passes */
  @Post('verify')
  @ApiOperation({ summary: 'Verify a JWT token is still valid' })
  verify() {
    return { valid: true };
  }

  /** Logout — public; client is responsible for clearing the token */
  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Logout (client clears token)' })
  logout() {
    return { ok: true };
  }
}
