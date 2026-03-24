import { Platform, MediaType } from '../enums/index.js';

export interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  profileId: string;
  accountName: string;
}

export interface TokenResult {
  accessToken: string;
  tokenExpiry?: Date;
}

export interface PostContent {
  text: string;
  mediaUrls?: string[];
  mediaType?: MediaType;
}

export interface PublishResult {
  platformPostId: string;
  url?: string;
}

export interface MediaUpload {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface ISocialProvider {
  platform: Platform;
  name: string;

  generateAuthUrl(userId: string): string;
  authenticate(code: string, userId: string): Promise<AuthResult>;
  refreshToken(refreshToken: string): Promise<TokenResult>;
  post(accessToken: string, content: PostContent): Promise<PublishResult>;
  uploadMedia?(accessToken: string, media: MediaUpload): Promise<string>;
}
