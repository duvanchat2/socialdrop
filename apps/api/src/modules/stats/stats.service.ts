import { Injectable } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [published, pending, failed, total, today] = await Promise.all([
      this.prisma.post.count({ where: { userId, status: 'PUBLISHED' } }),
      this.prisma.post.count({
        where: { userId, status: { in: ['PENDING', 'SCHEDULED'] } },
      }),
      this.prisma.post.count({ where: { userId, status: 'ERROR' } }),
      this.prisma.post.count({ where: { userId } }),
      this.prisma.post.count({
        where: {
          userId,
          status: 'PUBLISHED',
          publishedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    return { published, pending, failed, total, today };
  }

  async getByPlatform(userId: string) {
    const byPlatform = await this.prisma.integration.findMany({
      where: { userId },
      include: {
        posts: {
          select: { status: true },
        },
      },
    });

    return byPlatform.map((int) => ({
      platform: int.platform,
      accountName: int.accountName,
      published: int.posts.filter((p) => p.status === 'PUBLISHED').length,
      pending: int.posts.filter((p) => p.status === 'PENDING').length,
      failed: int.posts.filter((p) => p.status === 'ERROR').length,
    }));
  }
}
