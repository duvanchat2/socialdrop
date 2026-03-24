import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@socialdrop/shared';
import type { AuthResult, TokenResult, PostContent, PublishResult } from '@socialdrop/shared';
import { SocialAbstract, RefreshTokenError } from '../social-abstract.js';

@Injectable()
export class InstagramProvider extends SocialAbstract {
  private readonly logger = new Logger(InstagramProvider.name);
  platform = Platform.INSTAGRAM;
  name = 'Instagram';
  private readonly BASE_URL = 'https://graph.facebook.com/v18.0';

  constructor(private readonly config: ConfigService) { super(); }

  generateAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('INSTAGRAM_APP_ID', ''),
      redirect_uri: this.config.get<string>('INSTAGRAM_REDIRECT_URI', ''),
      scope: 'instagram_basic,instagram_content_publish,pages_show_list',
      response_type: 'code',
      state: userId,
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  }

  async authenticate(code: string, userId: string): Promise<AuthResult> {
    // Exchange code for short-lived token
    const params = new URLSearchParams({
      client_id: this.config.get<string>('INSTAGRAM_APP_ID', ''),
      client_secret: this.config.get<string>('INSTAGRAM_APP_SECRET', ''),
      redirect_uri: this.config.get<string>('INSTAGRAM_REDIRECT_URI', ''),
      code,
    });
    const res = await this.throttledFetch(`${this.BASE_URL}/oauth/access_token?${params}`, { method: 'GET' });
    const data = await res.json() as { access_token: string };

    // Exchange for long-lived token
    const llParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.get<string>('INSTAGRAM_APP_ID', ''),
      client_secret: this.config.get<string>('INSTAGRAM_APP_SECRET', ''),
      fb_exchange_token: data.access_token,
    });
    const llRes = await this.throttledFetch(`${this.BASE_URL}/oauth/access_token?${llParams}`, { method: 'GET' });
    const llData = await llRes.json() as { access_token: string; expires_in?: number };

    // Get Instagram Business account linked to the page
    const igAccountId = this.config.get<string>('INSTAGRAM_ACCOUNT_ID', '');
    const igRes = await this.throttledFetch(
      `${this.BASE_URL}/${igAccountId}?fields=name,username&access_token=${llData.access_token}`,
      { method: 'GET' },
    );
    const igData = await igRes.json() as { id?: string; name?: string; username?: string };

    return {
      accessToken: llData.access_token,
      profileId: igAccountId,
      accountName: igData.username ?? igData.name ?? igAccountId,
      tokenExpiry: llData.expires_in ? new Date(Date.now() + llData.expires_in * 1000) : undefined,
    };
  }

  async refreshToken(token: string): Promise<TokenResult> {
    // Refresh long-lived Instagram token
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: token,
    });
    const res = await this.throttledFetch(`${this.BASE_URL}/refresh_access_token?${params}`, { method: 'GET' });
    const data = await res.json() as { access_token: string; expires_in?: number };
    return {
      accessToken: data.access_token,
      tokenExpiry: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async post(accessToken: string, content: PostContent): Promise<PublishResult> {
    const igUserId = this.config.get<string>('INSTAGRAM_ACCOUNT_ID', '');
    const delays = [1000, 5000, 15000];
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let result: PublishResult;
        if (content.mediaType === 'VIDEO') {
          result = await this.postReel(accessToken, igUserId, content);
        } else if (content.mediaUrls && content.mediaUrls.length > 1) {
          result = await this.postCarousel(accessToken, igUserId, content);
        } else if (content.mediaUrls && content.mediaUrls.length === 1) {
          result = await this.postSingleImage(accessToken, igUserId, content);
        } else {
          // Instagram requires media; fallback to single text-based image post attempt
          throw new Error('Instagram requires at least one media URL');
        }
        this.logger.log(`[Instagram] ✓ Published postId=${result.platformPostId}`);
        return result;
      } catch (err) {
        lastError = err as Error;
        if (err instanceof RefreshTokenError) throw err;
        if (attempt < 2) {
          this.logger.warn(`[Instagram] Attempt ${attempt + 1} failed, retrying in ${delays[attempt]}ms`);
          await new Promise(r => setTimeout(r, delays[attempt]));
        }
      }
    }
    this.logger.error(`[Instagram] ✗ Error: ${lastError.message}`);
    throw lastError;
  }

  private async postSingleImage(token: string, igUserId: string, content: PostContent): Promise<PublishResult> {
    // Step 1: Create media container
    const containerRes = await this.throttledFetch(
      `${this.BASE_URL}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: content.mediaUrls![0],
          caption: content.text,
          access_token: token,
        }),
      },
    );
    const containerData = await containerRes.json() as { id: string };

    // Step 2: Publish the container
    const publishRes = await this.throttledFetch(
      `${this.BASE_URL}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: token,
        }),
      },
    );
    const publishData = await publishRes.json() as { id: string };
    return { platformPostId: publishData.id };
  }

  private async postCarousel(token: string, igUserId: string, content: PostContent): Promise<PublishResult> {
    // Step 1: Create individual image containers
    const childIds: string[] = [];
    for (const imageUrl of content.mediaUrls!) {
      const res = await this.throttledFetch(
        `${this.BASE_URL}/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: token,
          }),
        },
      );
      const data = await res.json() as { id: string };
      childIds.push(data.id);
    }

    // Step 2: Create carousel container
    const carouselRes = await this.throttledFetch(
      `${this.BASE_URL}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL_ALBUM',
          children: childIds.join(','),
          caption: content.text,
          access_token: token,
        }),
      },
    );
    const carouselData = await carouselRes.json() as { id: string };

    // Step 3: Publish carousel
    const publishRes = await this.throttledFetch(
      `${this.BASE_URL}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: token,
        }),
      },
    );
    const publishData = await publishRes.json() as { id: string };
    return { platformPostId: publishData.id };
  }

  private async postReel(token: string, igUserId: string, content: PostContent): Promise<PublishResult> {
    // Step 1: Create reel container
    const containerRes = await this.throttledFetch(
      `${this.BASE_URL}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: content.mediaUrls![0],
          caption: content.text,
          share_to_feed: true,
          access_token: token,
        }),
      },
    );
    const containerData = await containerRes.json() as { id: string };

    // Step 2: Poll until status is FINISHED
    let status = '';
    let pollAttempts = 0;
    const maxPollAttempts = 20;
    while (status !== 'FINISHED' && pollAttempts < maxPollAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await this.throttledFetch(
        `${this.BASE_URL}/${containerData.id}?fields=status_code&access_token=${token}`,
        { method: 'GET' },
      );
      const statusData = await statusRes.json() as { status_code: string };
      status = statusData.status_code;
      pollAttempts++;
      if (status === 'ERROR') {
        throw new Error('Instagram reel processing failed');
      }
    }

    if (status !== 'FINISHED') {
      throw new Error('Instagram reel processing timed out');
    }

    // Step 3: Publish the reel
    const publishRes = await this.throttledFetch(
      `${this.BASE_URL}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: token,
        }),
      },
    );
    const publishData = await publishRes.json() as { id: string };
    return { platformPostId: publishData.id };
  }
}
