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

import { PostSchedulerProcessor } from './post-scheduler.processor.js';

const mockPrisma = {
  integration: { findFirst: vi.fn() },
  flowExecution: { create: vi.fn() },
};

const mockIntegrationManager = {};
const mockQueue = { getRepeatableJobs: vi.fn().mockResolvedValue([]), add: vi.fn() };
const mockDebugLog = { push: vi.fn() };

function makeJob(name: string, data: object, overrides: Partial<{ attemptsMade: number; opts: object }> = {}) {
  return {
    name,
    data,
    attemptsMade: overrides.attemptsMade ?? 0,
    opts: overrides.opts ?? { attempts: 1 },
  } as any;
}

describe('PostSchedulerProcessor — sequence-step routing', () => {
  let processor: PostSchedulerProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    processor = new PostSchedulerProcessor(mockPrisma as any, mockIntegrationManager as any, mockQueue as any, mockDebugLog as any);
  });

  it('routes job.name === "sequence-step" to the sequence handler, not scan/publish', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null); // short-circuits before any fetch
    await processor.process(makeJob('sequence-step', {
      sequenceId: 'seq-1', contactAccountId: 'acct-1', platform: 'FACEBOOK', message: 'hi', workspaceId: 'ws-1', stepIndex: 0,
    }));

    expect(mockPrisma.integration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws-1', platform: 'FACEBOOK' } }),
    );
  });

  it('is a no-op without touching Integration/FlowExecution when required fields are missing', async () => {
    await processor.process(makeJob('sequence-step', { sequenceId: 'seq-1' }));
    expect(mockPrisma.integration.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.flowExecution.create).not.toHaveBeenCalled();
  });

  it('logs and records FlowExecution=FAILED (no throw) when no integration exists for the workspace/platform', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null);
    await processor.process(makeJob('sequence-step', {
      sequenceId: 'seq-1', contactAccountId: 'acct-1', platform: 'FACEBOOK', message: 'hi', workspaceId: 'ws-1', stepIndex: 0,
    }));

    expect(mockDebugLog.push).toHaveBeenCalledWith('ws-1', 'error', 'FACEBOOK', expect.stringContaining('no FACEBOOK integration'));
    expect(mockPrisma.flowExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ flowId: 'seq-1', triggeredBy: 'acct-1', status: 'FAILED' }) }),
    );
  });

  it('sends the DM via the workspace integration token and records FlowExecution=COMPLETED on success', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({ id: 'int-1', accessToken: 'tok-123' });
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200, text: async () => '{}', clone: () => ({ text: async () => '{}' }) });

    await processor.process(makeJob('sequence-step', {
      sequenceId: 'seq-1', contactAccountId: 'acct-1', platform: 'FACEBOOK', message: 'hi', workspaceId: 'ws-1', stepIndex: 0,
    }));

    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('access_token=tok-123');
    expect(mockDebugLog.push).toHaveBeenCalledWith('ws-1', 'log', 'FACEBOOK', expect.stringContaining('DM sent'));
    expect(mockPrisma.flowExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
  });

  it('throws (so BullMQ retries) on a failed send, and only records FlowExecution=FAILED once retries are exhausted', { timeout: 20_000 }, async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({ id: 'int-1', accessToken: 'tok-123' });
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => 'boom', clone: () => ({ text: async () => 'boom' }) });

    // Mid-retry attempt: should throw but not record FlowExecution yet.
    await expect(
      processor.process(makeJob('sequence-step', {
        sequenceId: 'seq-1', contactAccountId: 'acct-1', platform: 'FACEBOOK', message: 'hi', workspaceId: 'ws-1', stepIndex: 0,
      }, { attemptsMade: 0, opts: { attempts: 3 } })),
    ).rejects.toThrow();
    expect(mockPrisma.flowExecution.create).not.toHaveBeenCalled();

    // Final attempt: should throw AND record FlowExecution=FAILED.
    await expect(
      processor.process(makeJob('sequence-step', {
        sequenceId: 'seq-1', contactAccountId: 'acct-1', platform: 'FACEBOOK', message: 'hi', workspaceId: 'ws-1', stepIndex: 0,
      }, { attemptsMade: 2, opts: { attempts: 3 } })),
    ).rejects.toThrow();
    expect(mockPrisma.flowExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });
});
