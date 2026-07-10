import { Inject, Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '@socialdrop/prisma';
import { MAIL_PROVIDER, MailProvider } from './mail-provider.interface.js';

const VERIFY_EMAIL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_PASSWORD_EXPIRY_MS = 60 * 60 * 1000; // 60min

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
  ) {}

  async register(email: string, password: string, name?: string): Promise<{ ok: true }> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      // Neutral response — do not reveal whether the email is already registered.
      throw new ConflictException('Revisa tu correo para continuar');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const rawToken = generateRawToken();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: normalizedEmail, name, passwordHash },
      });
      await tx.authToken.create({
        data: {
          userId: created.id,
          tokenHash: hashToken(rawToken),
          type: 'VERIFY_EMAIL',
          expiresAt: new Date(Date.now() + VERIFY_EMAIL_EXPIRY_MS),
        },
      });
      // Transparent default workspace — a user with a single workspace never
      // sees the concept (no switcher, everything scoped to it automatically).
      const workspace = await tx.workspace.create({
        data: { name: name?.trim() || 'Mi espacio' },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: created.id, role: 'OWNER' },
      });
      await tx.user.update({
        where: { id: created.id },
        data: { lastActiveWorkspaceId: workspace.id },
      });
      return created;
    });

    await this.mailProvider.send(user.email, 'verify-email', { token: rawToken, name: user.name ?? '' });
    return { ok: true };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; expiresAt: string; workspaceId: string | null } | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) return null;

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return null;

    const requireVerification = this.config.get<string>('REQUIRE_EMAIL_VERIFICATION') === 'true';
    if (requireVerification && !user.emailVerifiedAt) {
      throw new UnauthorizedException('Verifica tu correo antes de iniciar sesión');
    }

    const expirySeconds = this.parseExpiry(this.config.get<string>('JWT_EXPIRY', '7d'));
    const token = this.jwtService.sign({ sub: user.id, tokenVersion: user.tokenVersion });
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
    return { token, expiresAt, workspaceId: user.lastActiveWorkspaceId };
  }

  async verifyEmail(rawToken: string): Promise<{ ok: true }> {
    const authToken = await this.consumeToken(rawToken, 'VERIFY_EMAIL');
    await this.prisma.user.update({
      where: { id: authToken.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { ok: true };
  }

  /** Always resolves — never reveals whether the email exists. */
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      const rawToken = generateRawToken();
      await this.prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          type: 'RESET_PASSWORD',
          expiresAt: new Date(Date.now() + RESET_PASSWORD_EXPIRY_MS),
        },
      });
      await this.mailProvider.send(user.email, 'reset-password', { token: rawToken, name: user.name ?? '' });
    }
    return { ok: true };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ ok: true }> {
    const authToken = await this.consumeToken(rawToken, 'RESET_PASSWORD');
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: authToken.userId },
      // Invalidate all previously-issued JWTs by bumping tokenVersion.
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    return { ok: true };
  }

  private async consumeToken(rawToken: string, type: 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
    const tokenHash = hashToken(rawToken);
    const authToken = await this.prisma.authToken.findUnique({ where: { tokenHash } });
    if (
      !authToken ||
      authToken.type !== type ||
      authToken.usedAt ||
      authToken.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token inválido o expirado');
    }
    await this.prisma.authToken.update({ where: { id: authToken.id }, data: { usedAt: new Date() } });
    return authToken;
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
