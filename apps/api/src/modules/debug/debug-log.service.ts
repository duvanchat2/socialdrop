import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class DebugLogService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
      lazyConnect: true,
    });
  }

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

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
