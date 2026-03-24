import { Injectable } from '@nestjs/common';
import { Platform } from '@socialdrop/shared';
import type { AuthResult, TokenResult, PostContent, PublishResult } from '@socialdrop/shared';
import { SocialAbstract } from '../social-abstract.js';

@Injectable()
export class LinkedinProvider extends SocialAbstract {
  platform = Platform.LINKEDIN;
  name = 'LinkedIn';

  generateAuthUrl(userId: string): string {
    // TODO: Implement LinkedIn OAuth 2.0 3-legged flow URL
    throw new Error('Not implemented');
  }

  async authenticate(code: string, userId: string): Promise<AuthResult> {
    // TODO: Exchange code for tokens via LinkedIn OAuth 2.0
    throw new Error('Not implemented');
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    // TODO: Refresh LinkedIn access token
    throw new Error('Not implemented');
  }

  async post(accessToken: string, content: PostContent): Promise<PublishResult> {
    // TODO: Create post via LinkedIn Marketing API (ugcPosts)
    throw new Error('Not implemented');
  }
}
