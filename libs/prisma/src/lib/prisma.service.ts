import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Resolves the workspace a user's Integration rows live in, for services
   * that still key their own data by userId (Integration was migrated to
   * workspaceId in PR-32, most tenant tables were not — see PR-32 summary).
   * Falls back to any membership if lastActiveWorkspaceId isn't set.
   */
  async resolveWorkspaceIdForUser(userId: string): Promise<string | null> {
    const user = await this.user.findUnique({
      where: { id: userId },
      select: { lastActiveWorkspaceId: true },
    });
    if (user?.lastActiveWorkspaceId) return user.lastActiveWorkspaceId;

    const membership = await this.workspaceMember.findFirst({ where: { userId } });
    return membership?.workspaceId ?? null;
  }
}
