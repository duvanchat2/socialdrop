import { Module, OnModuleInit } from '@nestjs/common';
import {
  IntegrationManager,
  InstagramProvider,
  TwitterProvider,
  FacebookProvider,
  TiktokProvider,
  LinkedinProvider,
  YoutubeProvider,
} from '@socialdrop/integrations';
import { IntegrationsController } from './integrations.controller.js';

@Module({
  controllers: [IntegrationsController],
  providers: [
    IntegrationManager,
    InstagramProvider,
    TwitterProvider,
    FacebookProvider,
    TiktokProvider,
    LinkedinProvider,
    YoutubeProvider,
  ],
  exports: [IntegrationManager],
})
export class IntegrationsModule implements OnModuleInit {
  constructor(
    private readonly manager: IntegrationManager,
    private readonly instagram: InstagramProvider,
    private readonly twitter: TwitterProvider,
    private readonly facebook: FacebookProvider,
    private readonly tiktok: TiktokProvider,
    private readonly linkedin: LinkedinProvider,
    private readonly youtube: YoutubeProvider,
  ) {}

  onModuleInit(): void {
    this.manager.register(this.instagram);
    this.manager.register(this.twitter);
    this.manager.register(this.facebook);
    this.manager.register(this.tiktok);
    this.manager.register(this.linkedin);
    this.manager.register(this.youtube);
  }
}
