import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '@socialdrop/prisma';

export interface SequenceStep {
  message: string;
  delayHours: number;
}

export class CreateSequenceDto {
  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  steps!: SequenceStep[];
}

// Sequences are stored as Flows with trigger = 'SEQUENCE'
@Injectable()
export class SequencesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('post-scheduler') private readonly queue: Queue,
  ) {}

  findAll(workspaceId: string) {
    return this.prisma.flow.findMany({
      where: { workspaceId, trigger: 'SEQUENCE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(workspaceId: string, dto: CreateSequenceDto) {
    return this.prisma.flow.create({
      data: {
        workspaceId,
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
        {
          sequenceId,
          contactAccountId: contact.accountId,
          platform: contact.platform,
          message: step.message,
          stepIndex: index,
          workspaceId: sequence.workspaceId,
        },
        {
          delay: accumulatedDelayMs,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      );
    }
  }

  async remove(id: string, workspaceId: string) {
    return this.prisma.flow.deleteMany({ where: { id, workspaceId, trigger: 'SEQUENCE' } });
  }
}
