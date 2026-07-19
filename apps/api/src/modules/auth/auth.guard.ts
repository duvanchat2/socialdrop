import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@socialdrop/prisma';
import { IS_PUBLIC_KEY } from './auth.public.js';

interface JwtPayload {
  sub: string;
  tokenVersion?: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip JWT check for routes decorated with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      cookies?: Record<string, string | undefined>;
      user?: JwtPayload;
    }>();

    // Accept token from Authorization header OR from a cookie named "auth-token"
    const fromHeader = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    const fromCookie = req.cookies?.['auth-token'];
    const token = fromHeader ?? fromCookie;

    if (!token) throw new UnauthorizedException('Authentication required');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expired, please log in again');
    }

    req.user = payload;
    return true;
  }
}
