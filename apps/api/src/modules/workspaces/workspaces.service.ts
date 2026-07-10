import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });
    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
    }));
  }

  async create(userId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({ data: { name } });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId, role: 'OWNER' },
      });
      return workspace;
    });
  }

  async rename(workspaceId: string, userId: string, name: string) {
    await this.assertOwner(workspaceId, userId);
    return this.prisma.workspace.update({ where: { id: workspaceId }, data: { name } });
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  /**
   * Adds a member by email. If no account exists yet for that email, this
   * throws — real pending-invitation support (materializing on register) is
   * deferred; see PR-32 summary.
   */
  async addMember(workspaceId: string, requesterId: string, email: string, role: 'OWNER' | 'MEMBER') {
    await this.assertOwner(workspaceId, requesterId);

    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      throw new BadRequestException(
        'El usuario aún no tiene cuenta — las invitaciones pendientes se implementarán en un PR posterior.',
      );
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existing) return existing;

    return this.prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role },
    });
  }

  async removeMember(workspaceId: string, requesterId: string, targetUserId: string) {
    await this.assertOwner(workspaceId, requesterId);
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'OWNER') {
      throw new BadRequestException('El workspace debe tener siempre exactamente un OWNER');
    }
    await this.prisma.workspaceMember.delete({ where: { id: target.id } });
    return { ok: true };
  }

  private async assertMember(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this workspace');
    return membership;
  }

  private async assertOwner(workspaceId: string, userId: string) {
    const membership = await this.assertMember(workspaceId, userId);
    if (membership.role !== 'OWNER') throw new ForbiddenException('Only the workspace OWNER can do this');
    return membership;
  }
}
