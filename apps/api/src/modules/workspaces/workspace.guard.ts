import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';

/** Chained after AuthGuard — validates X-Workspace-Id against the caller's memberships. */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { 'x-workspace-id'?: string };
      user?: { sub: string };
      workspaceId?: string;
    }>();

    const workspaceId = req.headers['x-workspace-id'];
    const userId = req.user?.sub;
    if (!workspaceId || !userId) {
      throw new ForbiddenException('Missing or invalid X-Workspace-Id');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    req.workspaceId = workspaceId;
    return true;
  }
}
