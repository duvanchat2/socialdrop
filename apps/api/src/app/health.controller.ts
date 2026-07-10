import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  HealthCheckService,
  HealthCheck,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '@socialdrop/prisma';
import Redis from 'ioredis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    config: ConfigService,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
  ) {
    this.redis = new Redis({
      host: config.get<string>('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (err) {
      throw new HealthCheckError('Database check failed', { database: { status: 'down', message: (err as Error).message } });
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') throw new Error(`unexpected ping response: ${pong}`);
      return { redis: { status: 'up' } };
    } catch (err) {
      throw new HealthCheckError('Redis check failed', { redis: { status: 'down', message: (err as Error).message } });
    }
  }

  private async checkQueue(): Promise<HealthIndicatorResult> {
    try {
      const counts = await this.schedulerQueue.getJobCounts('waiting', 'active', 'delayed', 'failed');
      return { queue: { status: 'up', ...counts } };
    } catch (err) {
      throw new HealthCheckError('Queue check failed', { queue: { status: 'down', message: (err as Error).message } });
    }
  }

  @Get()
  @ApiOperation({ summary: 'Health check: Postgres, Redis, BullMQ queue' })
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkRedis(),
      () => this.checkQueue(),
    ]);
  }
}
