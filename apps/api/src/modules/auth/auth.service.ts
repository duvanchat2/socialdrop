import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  login(password: string): { token: string; expiresAt: string } | null {
    const appPassword = this.config.get<string>('APP_PASSWORD');

    // If APP_PASSWORD is not configured, auth is disabled (dev mode)
    if (!appPassword) return { token: 'dev-mode', expiresAt: new Date(Date.now() + 9999 * 86400_000).toISOString() };

    if (password !== appPassword) return null;

    const expirySeconds = this.parseExpiry(this.config.get<string>('JWT_EXPIRY', '7d'));
    const token = this.jwtService.sign({ sub: 'user' });
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
    return { token, expiresAt };
  }

  private parseExpiry(expiry: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiry);
    if (!match) return 7 * 86400;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (multipliers[unit] ?? 86400);
  }
}
