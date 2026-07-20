import type {
  ISocialProvider,
  AuthResult,
  TokenResult,
  PostContent,
  PublishResult,
  MediaUpload,
} from '@socialdrop/shared';
import { Platform } from '@socialdrop/shared';
import { isMetaRateLimitBody } from './graph-api.js';

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

      // Meta often returns rate-limit errors (code 4/17/32/613) as HTTP 200/400
      // with the error in the JSON body, not as a 429 — inspect it too.
      let rateLimited = response.status === 429;
      if (!rateLimited && (response.status === 200 || response.status === 400)) {
        const body = await response.clone().text().catch(() => '');
        rateLimited = isMetaRateLimitBody(body);
      }

      if (rateLimited || response.status >= 500) {
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
