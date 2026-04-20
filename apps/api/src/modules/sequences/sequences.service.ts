import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@socialdrop/prisma';

export interface CreateSequenceDto {
  name: string;
  steps: SequenceStep[];
}

export interface SequenceStep {
  message: string;
  delayHours: number;
}

// Sequences are stored as Flows with trigger = 'SEQUENCE'
@Injectable()
export class SequencesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('post-scheduler') private readonly queue: Queue,
  ) {}

  findAll(userId: string) {
    return this.prisma.flow.findMany({
      where: { userId, trigger: 'SEQUENCE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, dto: CreateSequenceDto) {
    return this.prisma.flow.create({
      data: {
        userId,
        name: dto.name,
        platform: 'ALL',
        trigger: 'SEQUENCE',
        nodes: dto.steps as any,
        edges: [],
      },
    });
  }

  async enroll(sequenceId: string, contactId: string): Promise<void> {
    const sequence = await this.prisma.flow.findFirst({
      where: { id: sequenceId, trigger: 'SEQUENCE' },
    });
    if (!sequence) return;

    const contact = await this.prisma.contact.findFirst({ where: { id: contactId } });
    if (!contact) return;

    const steps: SequenceStep[] = Array.isArray(sequence.nodes)
      ? (sequence.nodes as unknown as SequenceStep[])
      : [];

    let accumulatedDelayMs = 0;
    for (const [index, step] of steps.entries()) {
      accumulatedDelayMs += step.delayHours * 60 * 60 * 1000;
      await this.queue.add(
        'sequence-step',
        { sequenceId, contactAccountId: contact.accountId, platform: contact.platform, message: step.message, stepIndex: index },
        { delay: accumulatedDelayMs },
      );
    }
  }

  async remove(id: string, userId: string) {
    return this.prisma.flow.deleteMany({ where: { id, userId, trigger: 'SEQUENCE' } });
  }
}
