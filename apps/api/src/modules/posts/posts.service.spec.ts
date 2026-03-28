import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';

// Mock Logger to suppress output during tests
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

import { PostsService } from './posts.service.js';

const mockPrisma = {
  integration: {
    findMany: vi.fn(),
  },
  post: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  postIntegration: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
  },
};

const mockQueue = {
  add: vi.fn().mockResolvedValue({}),
  getRepeatableJobs: vi.fn().mockResolvedValue([]),
};

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PostsService(mockPrisma as any, mockQueue as any);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws BadRequestException when userId is empty', async () => {
      await expect(
        service.create('', { content: 'test', scheduledAt: new Date().toISOString(), platforms: ['TWITTER'] }),
      ).rejects.toThrow('userId is required');
    });

    it('creates a post and enqueues the scan job', async () => {
      mockPrisma.integration.findMany.mockResolvedValue([{ id: 'int-1', platform: 'TWITTER', userId: 'demo-user' }]);
      const mockPost = {
        id: 'post-1',
        content: 'hello world',
        scheduledAt: new Date(),
        status: 'SCHEDULED',
        integrations: [],
        media: [],
      };
      mockPrisma.post.create.mockResolvedValue(mockPost);

      const result = await service.create('demo-user', {
        content: 'hello world',
        scheduledAt: new Date().toISOString(),
        platforms: ['TWITTER'],
      });

      expect(result).toEqual(mockPost);
      expect(mockPrisma.post.create).toHaveBeenCalledOnce();
      expect(mockQueue.add).toHaveBeenCalledWith('scan', { type: 'scan' }, expect.objectContaining({ repeat: { every: 60_000 } }));
    });

    it('includes media records when mediaUrls are provided', async () => {
      mockPrisma.integration.findMany.mockResolvedValue([]);
      mockPrisma.post.create.mockResolvedValue({ id: 'p2', integrations: [], media: [{ url: 'https://cdn.example.com/img.jpg' }] });

      await service.create('demo-user', {
        content: 'with image',
        scheduledAt: new Date().toISOString(),
        platforms: ['INSTAGRAM'],
        mediaUrls: ['https://cdn.example.com/img.jpg'],
      });

      const createCall = mockPrisma.post.create.mock.calls[0][0];
      expect(createCall.data.media.create).toHaveLength(1);
      expect(createCall.data.media.create[0].mediaType).toBe('IMAGE');
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('throws when userId is empty', async () => {
      await expect(service.findAll('')).rejects.toThrow('userId is required');
    });

    it('returns posts list', async () => {
      const posts = [{ id: 'p1' }, { id: 'p2' }];
      mockPrisma.post.findMany.mockResolvedValue(posts);
      const result = await service.findAll('demo-user');
      expect(result).toEqual(posts);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws when post is already PUBLISHED', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'PUBLISHED',
        userId: 'demo-user',
        integrations: [],
        media: [],
      });
      await expect(service.update('p1', { content: 'new content' })).rejects.toThrow(
        'Cannot edit an already published post',
      );
    });

    it('updates content and scheduledAt for SCHEDULED posts', async () => {
      const existingPost = { id: 'p1', status: 'SCHEDULED', userId: 'demo-user', integrations: [], media: [] };
      mockPrisma.post.findUnique.mockResolvedValue(existingPost);
      const updated = { ...existingPost, content: 'updated caption' };
      mockPrisma.post.update.mockResolvedValue(updated);

      const result = await service.update('p1', { content: 'updated caption' });
      expect(result.content).toBe('updated caption');
      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' }, data: expect.objectContaining({ content: 'updated caption' }) }),
      );
    });
  });

  // ── retry ───────────────────────────────────────────────────────────────────

  describe('retry', () => {
    it('throws when post is not in ERROR status', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', status: 'SCHEDULED', integrations: [], media: [] });
      await expect(service.retry('p1')).rejects.toThrow('Only failed posts can be retried');
    });

    it('resets an ERROR post to SCHEDULED', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', status: 'ERROR', integrations: [], media: [] });
      mockPrisma.post.update.mockResolvedValue({ id: 'p1', status: 'SCHEDULED' });
      mockPrisma.postIntegration.updateMany.mockResolvedValue({});

      const result = await service.retry('p1');
      expect(result.message).toBe('Post queued for retry');
      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SCHEDULED', retryCount: 0, errorMessage: null }) }),
      );
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes an existing post', async () => {
      const post = { id: 'p1', status: 'SCHEDULED', integrations: [], media: [] };
      mockPrisma.post.findUnique.mockResolvedValue(post);
      mockPrisma.post.delete.mockResolvedValue(post);

      await service.remove('p1');
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('throws NotFoundException for non-existent post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);
      await expect(service.remove('not-found')).rejects.toThrow('Post not-found not found');
    });
  });
});
