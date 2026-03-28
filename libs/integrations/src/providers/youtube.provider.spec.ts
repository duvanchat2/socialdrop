import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';

// ── hoisted mocks ────────────────────────────────────────────────────────────
// Must use vi.hoisted() so these variables are available inside vi.mock() factories

const { mockVideosInsert, mockThumbnailsSet, mockChannelsList, mockOAuth2, MockOAuth2 } = vi.hoisted(() => {
  const mockOAuth2 = {
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock'),
    getToken: vi.fn().mockResolvedValue({
      tokens: { access_token: 'access-tok', refresh_token: 'refresh-tok', expiry_date: null },
    }),
    setCredentials: vi.fn(),
    refreshAccessToken: vi.fn().mockResolvedValue({
      credentials: { access_token: 'new-access-tok', expiry_date: null },
    }),
  };

  // Vitest 4.x: mocks used with `new` must be set via mockImplementation with a class
  class MockOAuth2 {
    constructor() {
      return mockOAuth2; // Return the shared mock object
    }
  }

  return {
    mockVideosInsert: vi.fn(),
    mockThumbnailsSet: vi.fn(),
    mockChannelsList: vi.fn(),
    mockOAuth2,
    MockOAuth2,
  };
});

// ── googleapis mock ──────────────────────────────────────────────────────────

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(MockOAuth2),
    },
    youtube: vi.fn().mockReturnValue({
      channels: { list: mockChannelsList },
      videos: { insert: mockVideosInsert },
      thumbnails: { set: mockThumbnailsSet },
    }),
  },
}));

// ── NestJS Logger mock ───────────────────────────────────────────────────────

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

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFetchWithStream() {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0, 1, 2]));
      controller.close();
    },
  });
  return vi.fn().mockResolvedValue({ ok: true, body: stream });
}

// ── import provider AFTER mocks ──────────────────────────────────────────────

import { YoutubeProvider } from './youtube.provider.js';

const mockConfig = {
  get: vi.fn((_key: string, defaultVal = '') => defaultVal),
};

describe('YoutubeProvider', () => {
  let provider: YoutubeProvider;

  beforeEach(() => {
    // Reset call history without clearing module-level implementations
    mockVideosInsert.mockClear();
    mockVideosInsert.mockResolvedValue({ data: { id: 'vid-abc' } });
    mockThumbnailsSet.mockClear();
    mockThumbnailsSet.mockResolvedValue({});
    mockChannelsList.mockClear();
    mockChannelsList.mockResolvedValue({
      data: { items: [{ id: 'ch-1', snippet: { title: 'My Channel' } }] },
    });
    mockOAuth2.setCredentials.mockClear();
    mockOAuth2.refreshAccessToken.mockClear();
    mockOAuth2.refreshAccessToken.mockResolvedValue({
      credentials: { access_token: 'new-access-tok', expiry_date: null },
    });
    provider = new YoutubeProvider(mockConfig as any);
  });

  // ── metadata.youtube ────────────────────────────────────────────────────────

  describe('metadata handling', () => {
    it('uses metadata.youtube.title when provided', async () => {
      global.fetch = makeFetchWithStream();

      await provider.post('access-tok', {
        text: 'Caption text',
        mediaUrls: ['https://example.com/video.mp4'],
        metadata: {
          youtube: { title: 'Custom YouTube Title', description: 'Custom desc', tags: ['react', 'tutorial'] },
        },
      });

      const insertArgs = mockVideosInsert.mock.calls[0][0];
      expect(insertArgs.requestBody.snippet.title).toBe('Custom YouTube Title');
      expect(insertArgs.requestBody.snippet.description).toBe('Custom desc');
      expect(insertArgs.requestBody.snippet.tags).toEqual(['react', 'tutorial']);
    });

    it('falls back to content.text when no metadata provided', async () => {
      global.fetch = makeFetchWithStream();

      await provider.post('access-tok', {
        text: 'Fallback caption',
        mediaUrls: ['https://example.com/video.mp4'],
      });

      const insertArgs = mockVideosInsert.mock.calls[0][0];
      expect(insertArgs.requestBody.snippet.title).toBe('Fallback caption');
      expect(insertArgs.requestBody.snippet.description).toBe('Fallback caption');
    });

    it('appends #Shorts to title when text contains #short', async () => {
      global.fetch = makeFetchWithStream();

      await provider.post('access-tok', {
        text: 'My short video #short',
        mediaUrls: ['https://example.com/video.mp4'],
      });

      const insertArgs = mockVideosInsert.mock.calls[0][0];
      expect(insertArgs.requestBody.snippet.title).toContain('#Shorts');
    });

    it('does not duplicate #Shorts if already present', async () => {
      global.fetch = makeFetchWithStream();

      await provider.post('access-tok', {
        text: 'My video #Shorts',
        mediaUrls: ['https://example.com/video.mp4'],
      });

      const insertArgs = mockVideosInsert.mock.calls[0][0];
      const title: string = insertArgs.requestBody.snippet.title;
      expect(title.match(/#Shorts/g)).toHaveLength(1);
    });

    it('truncates title to 100 characters', async () => {
      global.fetch = makeFetchWithStream();
      const longTitle = 'A'.repeat(120);

      await provider.post('access-tok', {
        text: 'Short caption',
        mediaUrls: ['https://example.com/video.mp4'],
        metadata: { youtube: { title: longTitle } },
      });

      const insertArgs = mockVideosInsert.mock.calls[0][0];
      expect(insertArgs.requestBody.snippet.title.length).toBeLessThanOrEqual(100);
    });
  });

  // ── error handling ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws when no mediaUrls are provided', async () => {
      await expect(
        provider.post('access-tok', { text: 'No video here' }),
      ).rejects.toThrow('YouTube requires a video URL to post');
    });

    it('throws when video fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, body: null });

      await expect(
        provider.post('access-tok', { text: 'Bad URL', mediaUrls: ['https://example.com/bad.mp4'] }),
      ).rejects.toThrow('Failed to fetch video from URL');
    }, 25_000);

    it('returns the published video id and url', async () => {
      global.fetch = makeFetchWithStream();

      const result = await provider.post('access-tok', {
        text: 'My video',
        mediaUrls: ['https://example.com/video.mp4'],
      });

      expect(result.platformPostId).toBe('vid-abc');
      expect(result.url).toBe('https://www.youtube.com/watch?v=vid-abc');
    });
  });

  // ── refreshToken ────────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns a new access token', async () => {
      const result = await provider.refreshToken('old-refresh-tok');
      expect(result.accessToken).toBe('new-access-tok');
    });

    it('wraps errors as RefreshTokenError', async () => {
      mockOAuth2.refreshAccessToken.mockRejectedValueOnce(new Error('invalid_grant'));
      await expect(provider.refreshToken('bad-tok')).rejects.toThrow('YouTube token refresh failed');
    });
  });
});
