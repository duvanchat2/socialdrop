import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';

vi.mock('@nestjs/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/common')>();
  return {
    ...actual,
    Logger: class {
      log = vi.fn();
      warn = vi.fn();
      error = vi.fn();
    },
  };
});

import { QueueService } from './queue.service.js';

const mockPrisma = {
  queueSlot: { findMany: vi.fn() },
  post: { findMany: vi.fn() },
};

describe('QueueService.findNextFreeSlot', () => {
  let service: QueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QueueService(mockPrisma as any);
  });

  it('returns the first candidate slot when there is no conflict', async () => {
    mockPrisma.queueSlot.findMany.mockResolvedValue([
      { id: 's1', dayOfWeek: 1, hour: 10, minute: 0 },
    ]);
    mockPrisma.post.findMany.mockResolvedValue([]);

    const from = new Date(2026, 0, 5); // Monday, local time
    const result = await service.findNextFreeSlot('u1', 'INSTAGRAM' as any, from);

    expect(result.slot.id).toBe('s1');
    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1);
  });

  it('skips a slot within 30 minutes of an already-scheduled post', async () => {
    mockPrisma.queueSlot.findMany.mockResolvedValue([
      { id: 's1', dayOfWeek: 1, hour: 10, minute: 0 },
      { id: 's2', dayOfWeek: 1, hour: 14, minute: 0 },
    ]);
    // Conflict 15 min after the first candidate (Mon 10:00 local)
    mockPrisma.post.findMany.mockResolvedValue([
      { scheduledAt: new Date(2026, 0, 5, 10, 15, 0) },
    ]);

    const from = new Date(2026, 0, 5);
    const result = await service.findNextFreeSlot('u1', 'INSTAGRAM' as any, from);

    expect(result.slot.id).toBe('s2');
    // Still exactly one aggregated query regardless of how many candidates were checked
    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1);
  });

  it('allows a candidate more than 30 minutes away from a scheduled post', async () => {
    mockPrisma.queueSlot.findMany.mockResolvedValue([
      { id: 's1', dayOfWeek: 1, hour: 10, minute: 0 },
    ]);
    mockPrisma.post.findMany.mockResolvedValue([
      { scheduledAt: new Date(2026, 0, 5, 11, 0, 0) },
    ]);

    const from = new Date(2026, 0, 5);
    const result = await service.findNextFreeSlot('u1', 'INSTAGRAM' as any, from);

    expect(result.slot.id).toBe('s1');
  });
});
