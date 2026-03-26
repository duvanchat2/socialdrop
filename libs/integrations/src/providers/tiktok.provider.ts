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
      scope:                 'user.info.basic,video.publish,video.upload,video.list',
      response_type:         'code',
      state:                 userId,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
    });

    const url = `${this.AUTH_BASE}/v2/auth/authorize?${params}`;
    this.logger.log(`[TikTok] Auth URL generated for userId=${userId} (PKCE S256) scopes=user.info.basic,video.publish,video.upload,video.list`);
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

    this.logger.log(`[TikTok] Exchanging authorization code for tokens (grant_type=authorization_code)`);

    const res = await fetch(`${this.API_BASE}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    this.logger.log(`[TikTok] Token exchange response status: ${res.status}`);

    if (res.status === 401) throw new RefreshTokenError();

    // TikTok /v2/oauth/token/ returns a flat response (no nested "data" wrapper)
    const data = await res.json() as {
      access_token?: string;
      refresh_token?: string;
      open_id?: string;
      expires_in?: number;
      refresh_expires_in?: number;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    };

    if (!data.access_token) {
      this.logger.error(`[TikTok] Token exchange failed — full response: ${JSON.stringify(data)}`);
      throw new Error(`TikTok auth failed: ${data.error_description ?? data.error ?? JSON.stringify(data)}`);
    }

    this.logger.log(
      `[TikTok] Token exchange OK — access_token=${data.access_token.substring(0, 10)}... ` +
      `refresh_token=${data.refresh_token ? 'present' : 'MISSING'} ` +
      `open_id=${data.open_id} ` +
      `expires_in=${data.expires_in}s ` +
      `scope=${data.scope ?? 'not returned'}`,
    );

    // Fetch user display name
    this.logger.debug(`[TikTok] Fetching user info with access_token=${data.access_token.substring(0, 10)}...`);
    const userRes = await fetch(
      `${this.API_BASE}/v2/user/info/?fields=display_name,username`,
      { headers: { Authorization: `Bearer ${data.access_token}` } },
    );

    this.logger.log(`[TikTok] User info response status: ${userRes.status}`);

    if (!userRes.ok) {
      const errBody = await userRes.text().catch(() => '');
      this.logger.warn(`[TikTok] User info request failed (${userRes.status}): ${errBody}`);
    }

    const userData = await (userRes.ok ? userRes.json() : Promise.resolve({})) as {
      data?: { user?: { display_name?: string; username?: string } };
    };
    const displayName =
      userData.data?.user?.display_name ??
      userData.data?.user?.username ??
      data.open_id!;

    this.logger.log(`[TikTok] ✓ Authenticated as ${displayName} (open_id=${data.open_id})`);

    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      profileId:    data.open_id!,
      accountName:  displayName,
      tokenExpiry:  new Date(Date.now() + data.expires_in! * 1000),
    };
  }

  async refreshToken(token: string): Promise<TokenResult> {
    this.logger.log(`[TikTok] Refreshing token (refresh_token=${token.substring(0, 10)}...)`);

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

    this.logger.log(`[TikTok] Token refresh response status: ${res.status}`);

    if (res.status === 401) throw new RefreshTokenError();

    // TikTok /v2/oauth/token/ returns a flat response (no nested "data" wrapper)
    const data = await res.json() as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!data.access_token) {
      this.logger.error(`[TikTok] Token refresh failed — full response: ${JSON.stringify(data)}`);
      throw new RefreshTokenError(`TikTok token refresh failed: ${data.error_description ?? data.error}`);
    }

    this.logger.log(
      `[TikTok] Token refresh OK — new access_token=${data.access_token.substring(0, 10)}... ` +
      `expires_in=${data.expires_in}s`,
    );

    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiry:  new Date(Date.now() + data.expires_in! * 1000),
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
    const videoUrl = content.mediaUrls![0];
    this.logger.debug(`[TikTok] Downloading video from ${videoUrl}`);

    // Download video — FILE_UPLOAD avoids TikTok's URL domain verification requirement
    const videoFetch = await fetch(videoUrl);
    if (!videoFetch.ok) {
      throw new Error(`Failed to fetch video (${videoFetch.status}): ${videoUrl}`);
    }
    const videoBuffer = Buffer.from(await videoFetch.arrayBuffer());
    const videoSize   = videoBuffer.length;

    // Use at most 64 MB per chunk; small videos upload as a single chunk
    const MAX_CHUNK    = 64 * 1024 * 1024;
    const chunkSize    = Math.min(videoSize, MAX_CHUNK);
    const totalChunks  = Math.ceil(videoSize / chunkSize);

    this.logger.log(
      `[TikTok] Video ready — size=${videoSize}B chunks=${totalChunks} ` +
      `(token=${accessToken.substring(0, 10)}...)`,
    );

    // Query creator info to get allowed privacy levels for this account
    const creatorRes = await fetch(`${this.API_BASE}/v2/post/publish/creator_info/query/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const creatorData = await creatorRes.json() as {
      data?: { privacy_level_options?: string[] };
      error?: { code?: string; message?: string };
    };
    const privacyOptions = creatorData.data?.privacy_level_options ?? [];
    let privacyLevel = privacyOptions.includes('PUBLIC_TO_EVERYONE')
      ? 'PUBLIC_TO_EVERYONE'
      : (privacyOptions[0] ?? 'SELF_ONLY');
    this.logger.log(`[TikTok] Creator privacy options: ${JSON.stringify(privacyOptions)}, using: ${privacyLevel}`);

    // Init upload — may retry once with SELF_ONLY if app is unaudited
    let initData: { data?: { publish_id: string; upload_url: string }; error?: { code?: string; message?: string } };
    for (let attempt = 0; attempt < 2; attempt++) {
      const initRes = await fetch(`${this.API_BASE}/v2/post/publish/video/init/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title:           content.text,
            privacy_level:   privacyLevel,
            disable_duet:    false,
            disable_comment: false,
            disable_stitch:  false,
          },
          source_info: {
            source:            'FILE_UPLOAD',
            video_size:        videoSize,
            chunk_size:        chunkSize,
            total_chunk_count: totalChunks,
          },
        }),
      });

      this.logger.log(`[TikTok] Video init response status: ${initRes.status} (privacy=${privacyLevel})`);
      if (initRes.status === 401) throw new RefreshTokenError();

      initData = await initRes.json() as typeof initData;

      if (initData.error?.code === 'unaudited_client_can_only_post_to_private_accounts' && privacyLevel !== 'SELF_ONLY') {
        this.logger.warn('[TikTok] App is unaudited — retrying with SELF_ONLY privacy');
        privacyLevel = 'SELF_ONLY';
        continue;
      }
      break;
    }

    if (!initData!.data?.publish_id || !initData!.data?.upload_url) {
      this.logger.error(`[TikTok] Video init failed — full response: ${JSON.stringify(initData!)}`);
      throw new Error(`TikTok video init failed: ${initData!.error?.message ?? JSON.stringify(initData!)}`);
    }

    // Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end   = Math.min(start + chunkSize, videoSize);
      const chunk = videoBuffer.subarray(start, end);

      this.logger.debug(`[TikTok] Uploading chunk ${i + 1}/${totalChunks} bytes ${start}-${end - 1}/${videoSize}`);

      const uploadRes = await fetch(initData!.data!.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type':   'video/mp4',
          'Content-Range':  `bytes ${start}-${end - 1}/${videoSize}`,
          'Content-Length': String(chunk.length),
        },
        body: chunk,
      });

      if (!uploadRes.ok) {
        const errBody = await uploadRes.text().catch(() => '');
        throw new Error(
          `TikTok video upload chunk ${i + 1}/${totalChunks} failed (${uploadRes.status}): ${errBody}`,
        );
      }

      this.logger.log(`[TikTok] Chunk ${i + 1}/${totalChunks} uploaded (${uploadRes.status})`);
    }

    return this.pollPublishStatus(accessToken, initData!.data!.publish_id, 30);
  }

  private async postPhoto(accessToken: string, content: PostContent): Promise<PublishResult> {
    this.logger.debug(`[TikTok] Initiating photo publish (token=${accessToken.substring(0, 10)}...)`);

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

    this.logger.log(`[TikTok] Photo init response status: ${initRes.status}`);

    if (initRes.status === 401) throw new RefreshTokenError();

    const initData = await initRes.json() as {
      data?: { publish_id: string };
      error?: { code?: string; message?: string };
    };

    if (!initData.data?.publish_id) {
      this.logger.error(`[TikTok] Photo init failed — full response: ${JSON.stringify(initData)}`);
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

      this.logger.debug(`[TikTok] Poll status response: ${res.status}`);

      if (res.status === 401) throw new RefreshTokenError();

      const data = await res.json() as {
        data?: { status: string; publicaly_available_post_id?: string[] };
        error?: { code?: string; message?: string };
      };

      const status = data.data?.status ?? '';
      this.logger.debug(`[TikTok] Poll ${i + 1}/${maxAttempts} publishId=${publishId} status=${status}`);

      if (status === 'FAILED') {
        this.logger.error(`[TikTok] Publish FAILED — full response: ${JSON.stringify(data)}`);
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
