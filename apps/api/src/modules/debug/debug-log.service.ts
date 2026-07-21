import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@socialdrop/prisma';
import Redis from 'ioredis';

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'debug';
  context: string;
  message: string;
  error?: string;
}

const MAX_ENTRIES = 500;
const KEY_PREFIX = 'debug:logs:';
const RETENTION_DAYS = parseInt(process.env.EVENT_LOG_RETENTION_DAYS ?? '30', 10);

@Injectable()
export class DebugLogService implements OnModuleDestroy {
  private readonly logger = new Logger(DebugLogService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    this.redis = new Redis({
      host: config.get<string>('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
      lazyConnect: true,
    });
  }

  /** Live-panel log — Redis only, rotates at MAX_ENTRIES, no long-term guarantee. */
  async push(
    userId: string,
    level: LogEntry['level'],
    context: string,
    message: string,
    error?: string,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...(error ? { error } : {}),
    };
    const key = `${KEY_PREFIX}${userId}`;
    try {
      await this.redis.lpush(key, JSON.stringify(entry));
      await this.redis.ltrim(key, 0, MAX_ENTRIES - 1);
    } catch {
      // Non-fatal: if Redis is down, just skip debug log
    }
  }

  /**
   * Same as push(), plus a durable EventLog row for events that must survive
   * Redis rotation (publish failures, needsReauth). Use for anything an
   * operator would need to find days later, not routine chatter.
   */
  async pushCritical(
    userId: string,
    level: LogEntry['level'],
    context: string,
    message: string,
    error?: string,
  ): Promise<void> {
    await this.push(userId, level, context, message, error);
    try {
      await this.prisma.eventLog.create({
        data: { userId, level, context, message, error },
      });
    } catch (e) {
      this.logger.error(`[DebugLog] Failed to persist EventLog: ${(e as Error).message}`);
    }
  }

  async getLogs(userId: string, limit = 50): Promise<LogEntry[]> {
    const key = `${KEY_PREFIX}${userId}`;
    try {
      const raw = await this.redis.lrange(key, 0, limit - 1);
      return raw.map((r) => {
        try {
          return JSON.parse(r) as LogEntry;
        } catch {
          return { timestamp: new Date().toISOString(), level: 'log', context: 'unknown', message: r };
        }
      });
    } catch {
      return [];
    }
  }

  async clearLogs(userId: string): Promise<void> {
    const key = `${KEY_PREFIX}${userId}`;
    try {
      await this.redis.del(key);
    } catch {
      // non-fatal
    }
  }

  /** Persisted critical events for a user, most recent first — powers a durable /debug view. */
  async getEventLogs(userId: string, limit = 100) {
    return this.prisma.eventLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  @Cron('0 5 * * *')
  async cleanupOldEventLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const { count } = await this.prisma.eventLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(`[DebugLog] cleanupOldEventLogs: removed ${count} EventLog row(s) older than ${cutoff.toISOString()}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
