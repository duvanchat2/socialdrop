import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@socialdrop/shared';
import type { AuthResult, TokenResult, PostContent, PublishResult } from '@socialdrop/shared';
import { SocialAbstract, RefreshTokenError } from '../social-abstract.js';
import * as crypto from 'crypto';

@Injectable()
export class TwitterProvider extends SocialAbstract {
  private readonly logger = new Logger(TwitterProvider.name);
  platform = Platform.TWITTER;
  name = 'Twitter/X';
  private readonly API_BASE = 'https://api.twitter.com';
  private readonly UPLOAD_BASE = 'https://upload.twitter.com';

  constructor(private readonly config: ConfigService) { super(); }

  generateAuthUrl(userId: string): string {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.get<string>('X_API_KEY', ''),
      redirect_uri: this.config.get<string>('X_REDIRECT_URI', ''),
      scope: 'tweet.read tweet.write users.read offline.access media.write',
      state: `${userId}:${codeVerifier}`,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  }

  async authenticate(code: string, userId: string): Promise<AuthResult> {
    // userId here contains state which may include codeVerifier: "userId:codeVerifier"
    // The codeVerifier should be stored server-side in production; here we derive from state
    const [, codeVerifier] = userId.split(':');

    const credentials = Buffer.from(
      `${this.config.get<string>('X_API_KEY', '')}:${this.config.get<string>('X_API_SECRET', '')}`
    ).toString('base64');

    const res = await fetch(`${this.API_BASE}/2/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.get<string>('X_REDIRECT_URI', ''),
        code_verifier: codeVerifier ?? 'challenge',
      }),
    });

    if (res.status === 401) throw new RefreshTokenError();

    const data = await res.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!data.access_token) {
      throw new Error(`Twitter auth failed: ${data.error_description ?? data.error}`);
    }

    // Fetch user info
    const userRes = await fetch(`${this.API_BASE}/2/users/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await userRes.json() as {
      data?: { id: string; name: string; username: string };
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      profileId: userData.data?.id ?? '',
      accountName: userData.data?.username ?? userData.data?.name ?? '',
      tokenExpiry: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshToken(token: string): Promise<TokenResult> {
    const credentials = Buffer.from(
      `${this.config.get<string>('X_API_KEY', '')}:${this.config.get<string>('X_API_SECRET', '')}`
    ).toString('base64');

    const res = await fetch(`${this.API_BASE}/2/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token,
      }),
    });

    if (res.status === 401) throw new RefreshTokenError();

    const data = await res.json() as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!data.access_token) {
      throw new RefreshTokenError(`Twitter token refresh failed: ${data.error}`);
    }

    return {
      accessToken: data.access_token,
      tokenExpiry: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async post(accessToken: string, content: PostContent): Promise<PublishResult> {
    const delays = [1000, 5000, 15000];
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let result: PublishResult;

        if (content.text.length > 280) {
          result = await this.postThread(accessToken, content);
        } else if (content.mediaUrls && content.mediaUrls.length > 0) {
          result = await this.postWithMedia(accessToken, content);
        } else {
          result = await this.postTweet(accessToken, content.text);
        }
        this.logger.log(`[Twitter] ✓ Published postId=${result.platformPostId}`);
        return result;
      } catch (err) {
        lastError = err as Error;
        if (err instanceof RefreshTokenError) throw err;
        if (attempt < 2) {
          this.logger.warn(`[Twitter] Attempt ${attempt + 1} failed, retrying in ${delays[attempt]}ms`);
          await new Promise(r => setTimeout(r, delays[attempt]));
        }
      }
    }
    this.logger.error(`[Twitter] ✗ Error: ${lastError.message}`);
    throw lastError;
  }

  private async postTweet(accessToken: string, text: string, replyToId?: string): Promise<PublishResult> {
    const body: Record<string, unknown> = { text };
    if (replyToId) {
      body['reply'] = { in_reply_to_tweet_id: replyToId };
    }

    const res = await fetch(`${this.API_BASE}/2/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) throw new RefreshTokenError();

    const data = await res.json() as {
      data?: { id: string; text: string };
      errors?: Array<{ message: string }>;
    };

    if (!data.data?.id) {
      throw new Error(`Twitter post failed: ${data.errors?.[0]?.message ?? JSON.stringify(data)}`);
    }

    return { platformPostId: data.data.id };
  }

  private splitIntoChunks(text: string, maxLen = 280): string[] {
    const chunks: string[] = [];
    const words = text.split(' ');
    let current = '';

    for (const word of words) {
      if ((current + (current ? ' ' : '') + word).length <= maxLen) {
        current += (current ? ' ' : '') + word;
      } else {
        if (current) chunks.push(current);
        current = word;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  private async postThread(accessToken: string, content: PostContent): Promise<PublishResult> {
    const chunks = this.splitIntoChunks(content.text, 280);
    let firstId: string | undefined;
    let lastId: string | undefined;

    for (let i = 0; i < chunks.length; i++) {
      const result = await this.postTweet(accessToken, chunks[i], lastId);
      if (i === 0) firstId = result.platformPostId;
      lastId = result.platformPostId;
    }

    return { platformPostId: firstId ?? lastId ?? '' };
  }

  private async postWithMedia(accessToken: string, content: PostContent): Promise<PublishResult> {
    const mediaIds: string[] = [];

    for (const url of content.mediaUrls!) {
      const mediaId = await this.uploadMediaFromUrl(accessToken, url, content.mediaType === 'VIDEO');
      mediaIds.push(mediaId);
    }

    const body: Record<string, unknown> = {
      text: content.text,
      media: { media_ids: mediaIds },
    };

    const res = await fetch(`${this.API_BASE}/2/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) throw new RefreshTokenError();

    const data = await res.json() as {
      data?: { id: string };
      errors?: Array<{ message: string }>;
    };

    if (!data.data?.id) {
      throw new Error(`Twitter media post failed: ${data.errors?.[0]?.message ?? JSON.stringify(data)}`);
    }

    return { platformPostId: data.data.id };
  }

  private async uploadMediaFromUrl(accessToken: string, mediaUrl: string, isVideo: boolean): Promise<string> {
    // Fetch the media
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to fetch media from URL: ${mediaUrl}`);
    }

    const buffer = Buffer.from(await mediaResponse.arrayBuffer());
    const mimeType = mediaResponse.headers.get('content-type') ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    const totalBytes = buffer.length;

    if (isVideo) {
      return this.uploadVideoChunked(accessToken, buffer, mimeType, totalBytes);
    } else {
      return this.uploadImageSimple(accessToken, buffer, mimeType);
    }
  }

  private async uploadImageSimple(accessToken: string, buffer: Buffer, mimeType: string): Promise<string> {
    const authHeader = this.buildOAuth1Header('POST', `${this.UPLOAD_BASE}/1.1/media/upload.json`, {});

    const formData = new FormData();
    formData.append('media_data', buffer.toString('base64'));

    const res = await fetch(`${this.UPLOAD_BASE}/1.1/media/upload.json`, {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: formData,
    });

    if (res.status === 401) throw new RefreshTokenError();

    const data = await res.json() as { media_id_string?: string; error?: string };
    if (!data.media_id_string) {
      throw new Error(`Twitter media upload failed: ${data.error ?? JSON.stringify(data)}`);
    }

    return data.media_id_string;
  }

  private async uploadVideoChunked(
    accessToken: string,
    buffer: Buffer,
    mimeType: string,
    totalBytes: number,
  ): Promise<string> {
    const uploadUrl = `${this.UPLOAD_BASE}/1.1/media/upload.json`;

    // INIT
    const initHeader = this.buildOAuth1Header('POST', uploadUrl, {});
    const initForm = new FormData();
    initForm.append('command', 'INIT');
    initForm.append('media_type', mimeType);
    initForm.append('total_bytes', String(totalBytes));
    initForm.append('media_category', 'tweet_video');

    const initRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: initHeader },
      body: initForm,
    });

    const initData = await initRes.json() as { media_id_string?: string };
    if (!initData.media_id_string) {
      throw new Error('Twitter video INIT failed');
    }
    const mediaId = initData.media_id_string;

    // APPEND in 5MB chunks
    const chunkSize = 5 * 1024 * 1024;
    let segmentIndex = 0;
    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
      const chunk = buffer.slice(offset, offset + chunkSize);
      const appendHeader = this.buildOAuth1Header('POST', uploadUrl, {});
      const appendForm = new FormData();
      appendForm.append('command', 'APPEND');
      appendForm.append('media_id', mediaId);
      appendForm.append('segment_index', String(segmentIndex));
      appendForm.append('media', new Blob([chunk], { type: mimeType }), 'chunk');

      await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: appendHeader },
        body: appendForm,
      });
      segmentIndex++;
    }

    // FINALIZE
    const finalizeHeader = this.buildOAuth1Header('POST', uploadUrl, {});
    const finalizeForm = new FormData();
    finalizeForm.append('command', 'FINALIZE');
    finalizeForm.append('media_id', mediaId);

    const finalizeRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: finalizeHeader },
      body: finalizeForm,
    });

    const finalizeData = await finalizeRes.json() as {
      media_id_string?: string;
      processing_info?: { state: string; check_after_secs?: number };
    };

    // Poll for processing completion
    if (finalizeData.processing_info) {
      let state = finalizeData.processing_info.state;
      while (state === 'pending' || state === 'in_progress') {
        const waitSecs = finalizeData.processing_info.check_after_secs ?? 5;
        await new Promise(r => setTimeout(r, waitSecs * 1000));

        const statusHeader = this.buildOAuth1Header('GET', uploadUrl, { command: 'STATUS', media_id: mediaId });
        const statusRes = await fetch(`${uploadUrl}?command=STATUS&media_id=${mediaId}`, {
          headers: { Authorization: statusHeader },
        });
        const statusData = await statusRes.json() as {
          processing_info?: { state: string; check_after_secs?: number };
        };
        state = statusData.processing_info?.state ?? 'succeeded';
      }
    }

    return mediaId;
  }

  private buildOAuth1Header(method: string, url: string, extraParams: Record<string, string>): string {
    const apiKey = this.config.get<string>('X_API_KEY', '');
    const apiSecret = this.config.get<string>('X_API_SECRET', '');
    const accessToken = this.config.get<string>('X_ACCESS_TOKEN', '');
    const accessSecret = this.config.get<string>('X_ACCESS_SECRET', '');

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_token: accessToken,
      oauth_version: '1.0',
      ...extraParams,
    };

    // Build signature base string
    const allParams = { ...oauthParams };
    const sortedParams = Object.keys(allParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
      .join('&');

    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams),
    ].join('&');

    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');

    oauthParams['oauth_signature'] = signature;

    const headerValue = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ');

    return headerValue;
  }
}
