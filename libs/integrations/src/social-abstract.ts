import type {
  ISocialProvider,
  AuthResult,
  TokenResult,
  PostContent,
  PublishResult,
  MediaUpload,
} from '@socialdrop/shared';
import { Platform } from '@socialdrop/shared';

export class RefreshTokenError extends Error {
  constructor(message = 'Token refresh required') {
    super(message);
    this.name = 'RefreshTokenError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export abstract class SocialAbstract implements ISocialProvider {
  abstract platform: Platform;
  abstract name: string;

  abstract generateAuthUrl(userId: string): string;
  abstract authenticate(code: string, userId: string): Promise<AuthResult>;
  abstract refreshToken(refreshToken: string): Promise<TokenResult>;
  abstract post(accessToken: string, content: PostContent): Promise<PublishResult>;

  async uploadMedia?(accessToken: string, media: MediaUpload): Promise<string>;

  protected async throttledFetch(
    url: string,
    options: RequestInit,
    retries = 3,
  ): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const response = await fetch(url, options);

      if (response.status === 401) {
        throw new RefreshTokenError();
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new ApiError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          body,
        );
      }

      return response;
    }

    throw new ApiError('Max retries exceeded', 0);
  }
}
