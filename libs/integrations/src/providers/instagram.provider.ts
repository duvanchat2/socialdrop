import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@socialdrop/shared';
import type { AuthResult, TokenResult, PostContent, PublishResult } from '@socialdrop/shared';
import { SocialAbstract, RefreshTokenError } from '../social-abstract.js';

interface IgApiResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
}

@Injectable()
export class InstagramProvider extends SocialAbstract {
  private readonly logger = new Logger(InstagramProvider.name);
  platform = Platform.INSTAGRAM;
  name = 'Instagram';
  private readonly BASE_URL = 'https://graph.facebook.com/v18.0';

  constructor(private readonly config: ConfigService) { super(); }

  /**
   * Fetch and parse JSON; throw with full API error body if the response contains
   * an `error` field (Meta Graph API returns HTTP 200 even for errors sometimes).
   */
  private async igFetch(url: string, options: RequestInit = {}, step = 'request'): Promise<IgApiResponse> {
    const res = await this.throttledFetch(url, options);
    const body = await res.text();
    let data: IgApiResponse;
    try {
      data = JSON.parse(body) as IgApiResponse;
    } catch {
      throw new Error(`[Instagram] ${step}: non-JSON response (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }

    if (!res.ok) {
      const msg = data.error?.message ?? body.slice(0, 200);
      const code = data.error?.code ?? res.status;
      const err = new Error(`[Instagram] ${step} HTTP ${res.status} (code ${code}): ${msg}`);
      if (res.status === 401 || code === 190) throw new RefreshTokenError(err.message);
      throw err;
    }

    if (data.error) {
      const { message, code, type } = data.error;
      const errMsg = `[Instagram] ${step} API error ${code} (${type}): ${message}`;
      this.logger.error(errMsg);
      if (code === 190 || code === 102) throw new RefreshTokenError(errMsg);
      throw new Error(errMsg);
    }

    return data;
  }

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
    const params = new URLSearchParams({
      client_id: this.config.get<string>('INSTAGRAM_APP_ID', ''),
      client_secret: this.config.get<string>('INSTAGRAM_APP_SECRET', ''),
      redirect_uri: this.config.get<string>('INSTAGRAM_REDIRECT_URI', ''),
      code,
    });
    const data = await this.igFetch(`${this.BASE_URL}/oauth/access_token?${params}`, { method: 'GET' }, 'short-lived token') as { access_token: string };

    const llParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.get<string>('INSTAGRAM_APP_ID', ''),
      client_secret: this.config.get<string>('INSTAGRAM_APP_SECRET', ''),
      fb_exchange_token: data.access_token,
    });
    const llData = await this.igFetch(`${this.BASE_URL}/oauth/access_token?${llParams}`, { method: 'GET' }, 'long-lived token') as { access_token: string; expires_in?: number };

    const igAccountId = this.config.get<string>('INSTAGRAM_ACCOUNT_ID', '');
    const igData = await this.igFetch(
      `${this.BASE_URL}/${igAccountId}?fields=name,username&access_token=${llData.access_token}`,
      { method: 'GET' }, 'account info',
    ) as { id?: string; name?: string; username?: string };

    return {
      accessToken: llData.access_token,
      profileId: igAccountId,
      accountName: (igData as any).username ?? (igData as any).name ?? igAccountId,
      tokenExpiry: (llData as any).expires_in ? new Date(Date.now() + (llData as any).expires_in * 1000) : undefined,
    };
  }

  async refreshToken(token: string): Promise<TokenResult> {
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: token,
    });
    const data = await this.igFetch(`${this.BASE_URL}/refresh_access_token?${params}`, { method: 'GET' }, 'refresh token') as { access_token: string; expires_in?: number };
    return {
      accessToken: (data as any).access_token,
      tokenExpiry: (data as any).expires_in ? new Date(Date.now() + (data as any).expires_in * 1000) : undefined,
    };
  }

  async post(accessToken: string, content: PostContent): Promise<PublishResult> {
    const igUserId = this.config.get<string>('INSTAGRAM_ACCOUNT_ID', '');
    this.logger.log(`[Instagram] post() igUserId=${igUserId} mediaUrls=${JSON.stringify(content.mediaUrls)} mediaType=${content.mediaType}`);

    if (!igUserId) throw new Error('[Instagram] INSTAGRAM_ACCOUNT_ID env var is not set');

    const delays = [1000, 5000, 15000];
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let result: PublishResult;
        if (content.mediaType === 'VIDEO') {
          this.logger.log(`[Instagram] Attempt ${attempt + 1}: postReel`);
          result = await this.postReel(accessToken, igUserId, content);
        } else if (content.mediaUrls && content.mediaUrls.length > 1) {
          this.logger.log(`[Instagram] Attempt ${attempt + 1}: postCarousel (${content.mediaUrls.length} images)`);
          result = await this.postCarousel(accessToken, igUserId, content);
        } else if (content.mediaUrls && content.mediaUrls.length === 1) {
          this.logger.log(`[Instagram] Attempt ${attempt + 1}: postSingleImage url=${content.mediaUrls[0]}`);
          result = await this.postSingleImage(accessToken, igUserId, content);
        } else {
          throw new Error('[Instagram] No media URL provided — Instagram requires at least one media URL');
        }
        this.logger.log(`[Instagram] ✓ Published platformPostId=${result.platformPostId}`);
        return result;
      } catch (err) {
        lastError = err as Error;
        this.logger.error(`[Instagram] Attempt ${attempt + 1} failed: ${lastError.message}`);
        if (err instanceof RefreshTokenError) throw err;
        if (attempt < 2) {
          this.logger.warn(`[Instagram] Retrying in ${delays[attempt]}ms...`);
          await new Promise(r => setTimeout(r, delays[attempt]));
        }
      }
    }
    this.logger.error(`[Instagram] ✗ All attempts failed: ${lastError.message}`);
    throw lastError;
  }

  private async postSingleImage(token: string, igUserId: string, content: PostContent): Promise<PublishResult> {
    this.logger.log(`[Instagram] Step 1/2: create media container for image_url=${content.mediaUrls![0]}`);
    const containerData = await this.igFetch(
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
      'create image container',
    );
    this.logger.log(`[Instagram] Step 1/2 done: containerId=${containerData.id}`);

    this.logger.log(`[Instagram] Step 2/2: publish container containerId=${containerData.id}`);
    const publishData = await this.igFetch(
      `${this.BASE_URL}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: token,
        }),
      },
      'publish image container',
    );
    return { platformPostId: publishData.id! };
  }

  private async postCarousel(token: string, igUserId: string, content: PostContent): Promise<PublishResult> {
    const childIds: string[] = [];
    for (let i = 0; i < content.mediaUrls!.length; i++) {
      this.logger.log(`[Instagram] Carousel: creating child container ${i + 1}/${content.mediaUrls!.length} url=${content.mediaUrls![i]}`);
      const data = await this.igFetch(
        `${this.BASE_URL}/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: content.mediaUrls![i],
            is_carousel_item: true,
            access_token: token,
          }),
        },
        `carousel child ${i + 1}`,
      );
      childIds.push(data.id!);
    }

    this.logger.log(`[Instagram] Carousel: creating carousel container with children=${childIds.join(',')}`);
    const carouselData = await this.igFetch(
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
      'carousel container',
    );

    this.logger.log(`[Instagram] Carousel: publishing containerId=${carouselData.id}`);
    const publishData = await this.igFetch(
      `${this.BASE_URL}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: token,
        }),
      },
      'publish carousel',
    );
    return { platformPostId: publishData.id! };
  }

  private async postReel(token: string, igUserId: string, content: PostContent): Promise<PublishResult> {
    this.logger.log(`[Instagram] Reel: creating container for video_url=${content.mediaUrls![0]}`);
    const containerData = await this.igFetch(
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
      'create reel container',
    );
    this.logger.log(`[Instagram] Reel: containerId=${containerData.id} — polling status...`);

    let status = '';
    let pollAttempts = 0;
    const maxPollAttempts = 20;
    while (status !== 'FINISHED' && pollAttempts < maxPollAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      const statusData = await this.igFetch(
        `${this.BASE_URL}/${containerData.id}?fields=status_code&access_token=${token}`,
        { method: 'GET' },
        `poll status attempt ${pollAttempts + 1}`,
      ) as { status_code?: string };
      status = (statusData as any).status_code ?? '';
      pollAttempts++;
      this.logger.log(`[Instagram] Reel status poll ${pollAttempts}: ${status}`);
      if (status === 'ERROR') throw new Error('[Instagram] Reel processing failed — Instagram returned ERROR status');
    }

    if (status !== 'FINISHED') throw new Error('[Instagram] Reel processing timed out after 100s');

    this.logger.log(`[Instagram] Reel: publishing containerId=${containerData.id}`);
    const publishData = await this.igFetch(
      `${this.BASE_URL}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: token,
        }),
      },
      'publish reel',
    );
    return { platformPostId: publishData.id! };
  }
}
