import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@socialdrop/shared';
import type { AuthResult, TokenResult, PostContent, PublishResult, MediaUpload } from '@socialdrop/shared';
import { SocialAbstract, RefreshTokenError } from '../social-abstract.js';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

@Injectable()
export class YoutubeProvider extends SocialAbstract {
  private readonly logger = new Logger(YoutubeProvider.name);
  platform = Platform.YOUTUBE;
  name = 'YouTube';

  constructor(private readonly config: ConfigService) { super(); }

  private createOAuth2Client(): OAuth2Client {
    return new google.auth.OAuth2(
      this.config.get<string>('YOUTUBE_CLIENT_ID', ''),
      this.config.get<string>('YOUTUBE_CLIENT_SECRET', ''),
      this.config.get<string>('YOUTUBE_REDIRECT_URI', ''),
    );
  }

  generateAuthUrl(userId: string): string {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ],
      state: userId,
      prompt: 'consent',
    });
  }

  async authenticate(code: string, userId: string): Promise<AuthResult> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
    });

    const channel = channelRes.data.items?.[0];
    const channelId = channel?.id ?? this.config.get<string>('YOUTUBE_CHANNEL_ID', '');
    const channelTitle = channel?.snippet?.title ?? 'YouTube Channel';

    return {
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token ?? undefined,
      profileId: channelId,
      accountName: channelTitle,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    };
  }

  async refreshToken(token: string): Promise<TokenResult> {
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: token });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      return {
        accessToken: credentials.access_token ?? '',
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      };
    } catch (err) {
      throw new RefreshTokenError(`YouTube token refresh failed: ${(err as Error).message}`);
    }
  }

  async post(accessToken: string, content: PostContent): Promise<PublishResult> {
    const delays = [1000, 5000, 15000];
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!content.mediaUrls || content.mediaUrls.length === 0) {
          throw new Error('YouTube requires a video URL to post');
        }

        const result = await this.uploadVideo(accessToken, content);
        this.logger.log(`[YouTube] ✓ Published postId=${result.platformPostId}`);
        return result;
      } catch (err) {
        lastError = err as Error;
        if (err instanceof RefreshTokenError) throw err;
        if (attempt < 2) {
          this.logger.warn(`[YouTube] Attempt ${attempt + 1} failed, retrying in ${delays[attempt]}ms`);
          await new Promise(r => setTimeout(r, delays[attempt]));
        }
      }
    }
    this.logger.error(`[YouTube] ✗ Error: ${lastError.message}`);
    throw lastError;
  }

  private async uploadVideo(accessToken: string, content: PostContent): Promise<PublishResult> {
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Determine if this is a Short (title hint: include #Shorts)
    const isShort = content.text?.toLowerCase().includes('#short') ?? false;
    const title = isShort && !content.text.includes('#Shorts')
      ? `${content.text} #Shorts`
      : content.text;

    // Fetch the video from URL and stream it
    const videoUrl = content.mediaUrls![0];
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok || !videoResponse.body) {
      throw new Error(`Failed to fetch video from URL: ${videoUrl}`);
    }

    // Convert ReadableStream to Node.js Readable
    const nodeReadable = Readable.fromWeb(videoResponse.body as import('stream/web').ReadableStream);

    const uploadRes = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: title.substring(0, 100),
          description: content.text,
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus: 'public',
        },
      },
      media: {
        mimeType: 'video/*',
        body: nodeReadable,
      },
    });

    const videoId = uploadRes.data.id ?? '';

    // Set thumbnail if additional image URL provided
    if (content.mediaUrls && content.mediaUrls.length > 1) {
      try {
        const thumbUrl = content.mediaUrls[1];
        const thumbResponse = await fetch(thumbUrl);
        if (thumbResponse.ok && thumbResponse.body) {
          const thumbReadable = Readable.fromWeb(thumbResponse.body as import('stream/web').ReadableStream);
          await youtube.thumbnails.set({
            videoId,
            media: {
              mimeType: 'image/jpeg',
              body: thumbReadable,
            },
          });
        }
      } catch (err) {
        this.logger.warn(`[YouTube] Failed to set thumbnail: ${(err as Error).message}`);
      }
    }

    return {
      platformPostId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  override async uploadMedia(accessToken: string, media: MediaUpload): Promise<string> {
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const readable = Readable.from(media.buffer);

    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: media.fileName,
          description: '',
          categoryId: '22',
        },
        status: {
          privacyStatus: 'unlisted',
        },
      },
      media: {
        mimeType: media.mimeType,
        body: readable,
      },
    });

    return res.data.id ?? '';
  }
}
