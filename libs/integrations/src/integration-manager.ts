import { Injectable } from '@nestjs/common';
import { Platform } from '@socialdrop/shared';
import type { SocialAbstract } from './social-abstract.js';

@Injectable()
export class IntegrationManager {
  private providers = new Map<Platform, SocialAbstract>();

  register(provider: SocialAbstract): void {
    this.providers.set(provider.platform, provider);
  }

  getProvider(platform: Platform): SocialAbstract {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new Error(`No provider registered for platform: ${platform}`);
    }
    return provider;
  }

  getAllProviders(): SocialAbstract[] {
    return Array.from(this.providers.values());
  }

  hasProvider(platform: Platform): boolean {
    return this.providers.has(platform);
  }
}
