import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@socialdrop/shared';
import type { AuthResult, TokenResult, PostContent, PublishResult } from '@socialdrop/shared';
import { SocialAbstract, RefreshTokenError } from '../social-abstract.js';

@Injectable()
export class FacebookProvider extends SocialAbstract {
  private readonly logger = new Logger(FacebookProvider.name);
  platform = Platform.FACEBOOK;
  name = 'Facebook';
  private readonly BASE_URL = 'https://graph.facebook.com/v18.0';

  constructor(private readonly config: ConfigService) { super(); }

  generateAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('FACEBOOK_APP_ID', ''),
      redirect_uri: this.config.get<string>('FACEBOOK_REDIRECT_URI', ''),
      scope: 'pages_manage_posts,pages_read_engagement,pages_show_list',
      response_type: 'code',
      state: userId,
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  }

  async authenticate(code: string, userId: string): Promise<AuthResult> {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('FACEBOOK_APP_ID', ''),
      client_secret: this.config.get<string>('FACEBOOK_APP_SECRET', ''),
      redirect_uri: this.config.get<string>('FACEBOOK_REDIRECT_URI', ''),
      code,
    });
    const res = await this.throttledFetch(`${this.BASE_URL}/oauth/access_token?${params}`, { method: 'GET' });
    const data = await res.json() as { access_token: string; token_type: string };

    // Exchange for long-lived token
    const llParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.get<string>('FACEBOOK_APP_ID', ''),
      client_secret: this.config.get<string>('FACEBOOK_APP_SECRET', ''),
      fb_exchange_token: data.access_token,
    });
    const llRes = await this.throttledFetch(`${this.BASE_URL}/oauth/access_token?${llParams}`, { method: 'GET' });
    const llData = await llRes.json() as { access_token: string; expires_in?: number };

    // Get page access token
    const pageId = this.config.get<string>('FACEBOOK_PAGE_ID', '');
    const pageRes = await this.throttledFetch(
      `${this.BASE_URL}/${pageId}?fields=access_token,name&access_token=${llData.access_token}`,
      { method: 'GET' },
    );
    const pageData = await pageRes.json() as { access_token: string; name: string };

    return {
      accessToken: pageData.access_token,
      profileId: pageId,
      accountName: pageData.name,
      tokenExpiry: llData.expires_in ? new Date(Date.now() + llData.expires_in * 1000) : undefined,
    };
  }

  async refreshToken(token: string): Promise<TokenResult> {
    // Facebook page tokens are long-lived; just return the same token
    return { accessToken: token };
  }

  async post(accessToken: string, content: PostContent): Promise<PublishResult> {
    const pageId = this.config.get<string>('FACEBOOK_PAGE_ID', '');
    const delays = [1000, 5000, 15000];
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let result: PublishResult;
        if (content.mediaUrls && content.mediaUrls.length > 0 && content.mediaType === 'VIDEO') {
          result = await this.postVideo(accessToken, pageId, content);
        } else if (content.mediaUrls && content.mediaUrls.length > 1) {
          result = await this.postCarousel(accessToken, pageId, content);
        } else if (content.mediaUrls && content.mediaUrls.length === 1) {
          result = await this.postPhoto(accessToken, pageId, content);
        } else {
          result = await this.postText(accessToken, pageId, content);
        }
        this.logger.log(`[Facebook] ✓ Published postId=${result.platformPostId}`);
        return result;
      } catch (err) {
        lastError = err as Error;
        if (err instanceof RefreshTokenError) throw err;
        if (attempt < 2) {
          this.logger.warn(`[Facebook] Attempt ${attempt + 1} failed, retrying in ${delays[attempt]}ms`);
          await new Promise(r => setTimeout(r, delays[attempt]));
        }
      }
    }
    this.logger.error(`[Facebook] ✗ Error: ${lastError.message}`);
    throw lastError;
  }

  private async postText(token: string, pageId: string, content: PostContent): Promise<PublishResult> {
    const res = await this.throttledFetch(
      `${this.BASE_URL}/${pageId}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content.text, access_token: token }),
      },
    );
    const data = await res.json() as { id: string };
    return { platformPostId: data.id };
  }

  private async postPhoto(token: string, pageId: string, content: PostContent): Promise<PublishResult> {
    const res = await this.throttledFetch(
      `${this.BASE_URL}/${pageId}/photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: content.mediaUrls![0], caption: content.text, access_token: token }),
      },
    );
    const data = await res.json() as { id: string };
    return { platformPostId: data.id };
  }

  private async postCarousel(token: string, pageId: string, content: PostContent): Promise<PublishResult> {
    const attached: string[] = [];
    for (const url of content.mediaUrls!) {
      const res = await this.throttledFetch(
        `${this.BASE_URL}/${pageId}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, published: false, access_token: token }),
        },
      );
      const data = await res.json() as { id: string };
      attached.push(data.id);
    }
    const feedRes = await this.throttledFetch(
      `${this.BASE_URL}/${pageId}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.text,
          attached_media: attached.map(id => ({ media_fbid: id })),
          access_token: token,
        }),
      },
    );
    const feedData = await feedRes.json() as { id: string };
    return { platformPostId: feedData.id };
  }

  private async postVideo(token: string, pageId: string, content: PostContent): Promise<PublishResult> {
    const res = await this.throttledFetch(
      `https://graph-video.facebook.com/v18.0/${pageId}/videos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: content.mediaUrls![0], description: content.text, access_token: token }),
      },
    );
    const data = await res.json() as { id: string };
    return { platformPostId: data.id };
  }
}
