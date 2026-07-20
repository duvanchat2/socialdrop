import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@socialdrop/prisma';
import { Prisma } from '@prisma/client';

@Injectable()
export class DeadLetterService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
  ) {}

  async record(params: {
    workspaceId?: string;
    queueName: string;
    jobName: string;
    jobData: Prisma.InputJsonValue;
    reason: string;
  }) {
    return this.prisma.deadLetterJob.create({ data: params });
  }

  list(limit = 100) {
    return this.prisma.deadLetterJob.findMany({
      where: { requeuedAt: null },
      orderBy: { failedAt: 'desc' },
      take: limit,
    });
  }

  async requeue(id: string) {
    const row = await this.prisma.deadLetterJob.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Dead-letter job ${id} not found`);
    if (row.requeuedAt) throw new NotFoundException(`Dead-letter job ${id} was already requeued`);

    await this.schedulerQueue.add(row.jobName, row.jobData as object);
    return this.prisma.deadLetterJob.update({
      where: { id },
      data: { requeuedAt: new Date() },
    });
  }
}
