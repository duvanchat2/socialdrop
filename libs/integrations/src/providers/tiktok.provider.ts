import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Platform } from '@socialdrop/shared';
import type { AuthResult, TokenResult, PostContent, PublishResult } from '@socialdrop/shared';
import { SocialAbstract, RefreshTokenError } from '../social-abstract.js';

@Injectable()
export class TiktokProvider extends SocialAbstract {
  private readonly logger = new Logger(TiktokProvider.name);
  platform = Platform.TIKTOK;
  name = 'TikTok';
  private readonly AUTH_BASE = 'https://www.tiktok.com';
  private readonly API_BASE  = 'https://open.tiktokapis.com';

  /** In-memory PKCE store: state -> { codeVerifier, expiresAt } */
  private readonly pkceStore = new Map<string, { codeVerifier: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) { super(); }

  // ─── PKCE helpers ────────────────────────────────────────────────────────

  private generateCodeVerifier(): string {
    // 96 random bytes → 128-char base64url string (within 43-128 range)
    return crypto.randomBytes(96).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  private storePkce(state: string, codeVerifier: string): void {
    // Expire after 10 minutes
    this.pkceStore.set(state, { codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 });
    this.logger.debug(`[TikTok] PKCE stored for state=${state}`);
  }

  private retrievePkce(state: string): string | null {
    const entry = this.pkceStore.get(state);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.pkceStore.delete(state);
      return null;
    }
    this.pkceStore.delete(state); // one-time use
    return entry.codeVerifier;
  }

  // ─── OAuth ───────────────────────────────────────────────────────────────

  generateAuthUrl(userId: string): string {
    const codeVerifier  = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    this.storePkce(userId, codeVerifier);

    const params = new URLSearchParams({
      client_key:            this.config.get<string>('TIKTOK_CLIENT_KEY', ''),
      redirect_uri:          this.config.get<string>('TIKTOK_REDIRECT_URI', ''),
      scope:                 'user.info.basic,video.upload,video.list',
      response_type:         'code',
      state:                 userId,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
    });

    const url = `${this.AUTH_BASE}/v2/auth/authorize?${params}`;
    this.logger.log(`[TikTok] Auth URL generated for userId=${userId} (PKCE S256)`);
    return url;
  }

  async authenticate(code: string, userId: string): Promise<AuthResult> {
    const codeVerifier = this.retrievePkce(userId);
    if (!codeVerifier) {
      throw new Error(`TikTok PKCE verifier not found for state=${userId}. The OAuth flow may have expired.`);
    }

    const body = new URLSearchParams({
      client_key:    this.config.get<string>('TIKTOK_CLIENT_KEY', ''),
      client_secret: this.config.get<string>('TIKTOK_CLIENT_SECRET', ''),
      code,
      grant_type:    'authorization_code',
      redirect_uri:  this.config.get<string>('TIKTOK_REDIRECT_URI', ''),
      code_verifier: codeVerifier,
    });

    const res = await fetch(`${this.API_BASE}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (res.status === 401) throw new RefreshTokenError();

    const data = await res.json() as {
      data?: {
        access_token: string;
        refresh_token: string;
        open_id: string;
        expires_in: number;
        refresh_expires_in?: number;
      };
      error?: string;
      error_description?: string;
    };

    if (!data.data) {
      throw new Error(`TikTok auth failed: ${data.error_description ?? data.error ?? JSON.stringify(data)}`);
    }

    // Fetch user display name
    const userRes = await fetch(
      `${this.API_BASE}/v2/user/info/?fields=display_name,username`,
      { headers: { Authorization: `Bearer ${data.data.access_token}` } },
    );
    const userData = await userRes.json() as {
      data?: { user?: { display_name?: string; username?: string } };
    };
    const displayName =
      userData.data?.user?.display_name ??
      userData.data?.user?.username ??
      data.data.open_id;

    this.logger.log(`[TikTok] ✓ Authenticated as ${displayName} (open_id=${data.data.open_id})`);

    return {
      accessToken:  data.data.access_token,
      refreshToken: data.data.refresh_token,
      profileId:    data.data.open_id,
      accountName:  displayName,
      tokenExpiry:  new Date(Date.now() + data.data.expires_in * 1000),
    };
  }

  async refreshToken(token: string): Promise<TokenResult> {
    const res = await fetch(`${this.API_BASE}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key:    this.config.get<string>('TIKTOK_CLIENT_KEY', ''),
        client_secret: this.config.get<string>('TIKTOK_CLIENT_SECRET', ''),
        grant_type:    'refresh_token',
        refresh_token: token,
      }),
    });

    if (res.status === 401) throw new RefreshTokenError();

    const data = await res.json() as {
      data?: { access_token: string; expires_in: number };
      error?: string;
    };

    if (!data.data) {
      throw new RefreshTokenError(`TikTok token refresh failed: ${data.error}`);
    }

    return {
      accessToken: data.data.access_token,
      tokenExpiry: new Date(Date.now() + data.data.expires_in * 1000),
    };
  }

  // ─── Publishing ──────────────────────────────────────────────────────────

  async post(accessToken: string, content: PostContent): Promise<PublishResult> {
    const delays = [1000, 5000, 15000];
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let result: PublishResult;
        if (content.mediaType === 'VIDEO' && content.mediaUrls && content.mediaUrls.length > 0) {
          result = await this.postVideo(accessToken, content);
        } else if (content.mediaUrls && content.mediaUrls.length > 0) {
          result = await this.postPhoto(accessToken, content);
        } else {
          throw new Error('TikTok requires media (video or image) to post');
        }
        this.logger.log(`[TikTok] ✓ Published postId=${result.platformPostId}`);
        return result;
      } catch (err) {
        lastError = err as Error;
        if (err instanceof RefreshTokenError) throw err;
        if (attempt < 2) {
          this.logger.warn(`[TikTok] Attempt ${attempt + 1} failed, retrying in ${delays[attempt]}ms`);
          await new Promise(r => setTimeout(r, delays[attempt]));
        }
      }
    }
    this.logger.error(`[TikTok] ✗ Error: ${lastError.message}`);
    throw lastError;
  }

  private async postVideo(accessToken: string, content: PostContent): Promise<PublishResult> {
    const initRes = await fetch(`${this.API_BASE}/v2/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title:           content.text,
          privacy_level:   'PUBLIC_TO_EVERYONE',
          disable_duet:    false,
          disable_comment: false,
          disable_stitch:  false,
        },
        source_info: {
          source:    'PULL_FROM_URL',
          video_url: content.mediaUrls![0],
        },
      }),
    });

    if (initRes.status === 401) throw new RefreshTokenError();

    const initData = await initRes.json() as {
      data?: { publish_id: string };
      error?: { code?: string; message?: string };
    };

    if (!initData.data?.publish_id) {
      throw new Error(`TikTok video init failed: ${initData.error?.message ?? JSON.stringify(initData)}`);
    }

    return this.pollPublishStatus(accessToken, initData.data.publish_id, 30);
  }

  private async postPhoto(accessToken: string, content: PostContent): Promise<PublishResult> {
    const initRes = await fetch(`${this.API_BASE}/v2/post/publish/content/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title:           content.text,
          privacy_level:   'PUBLIC_TO_EVERYONE',
          disable_comment: false,
        },
        source_info: {
          source:             'PULL_FROM_URL',
          photo_cover_index:  0,
          photo_images:       content.mediaUrls,
        },
        post_mode:  'DIRECT_POST',
        media_type: 'PHOTO',
      }),
    });

    if (initRes.status === 401) throw new RefreshTokenError();

    const initData = await initRes.json() as {
      data?: { publish_id: string };
      error?: { code?: string; message?: string };
    };

    if (!initData.data?.publish_id) {
      throw new Error(`TikTok photo init failed: ${initData.error?.message ?? JSON.stringify(initData)}`);
    }

    return this.pollPublishStatus(accessToken, initData.data.publish_id, 20);
  }

  private async pollPublishStatus(
    accessToken: string,
    publishId: string,
    maxAttempts: number,
  ): Promise<PublishResult> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const res = await fetch(`${this.API_BASE}/v2/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
      });

      const data = await res.json() as {
        data?: { status: string; publicaly_available_post_id?: string[] };
        error?: { code?: string; message?: string };
      };

      const status = data.data?.status ?? '';
      this.logger.debug(`[TikTok] Poll ${i + 1}/${maxAttempts} publishId=${publishId} status=${status}`);

      if (status === 'FAILED') {
        throw new Error(`TikTok publish failed: ${data.error?.message ?? 'Unknown error'}`);
      }
      if (status === 'PUBLISH_COMPLETE') {
        const postId = data.data?.publicaly_available_post_id?.[0] ?? publishId;
        return { platformPostId: postId };
      }
    }
    throw new Error('TikTok publishing timed out');
  }
}
