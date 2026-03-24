import {
  Controller, Get, Post, Delete, Query, Param, Res, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '@socialdrop/prisma';
import { IntegrationManager } from '@socialdrop/integrations';
import { Platform } from '@socialdrop/shared';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationManager: IntegrationManager,
  ) {}

  @Get('available')
  @ApiOperation({ summary: 'List all available platforms' })
  getAvailable() {
    return this.integrationManager.getAllProviders().map((p) => ({
      platform: p.platform,
      name: p.name,
    }));
  }

  @Get()
  @ApiOperation({ summary: 'List connected integrations for a user' })
  async getUserIntegrations(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.prisma.integration.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        accountName: true,
        profileId: true,
        tokenExpiry: true,
        createdAt: true,
      },
    });
  }

  @Get('connect')
  @ApiOperation({ summary: 'Start OAuth flow or save static env credentials for a platform' })
  async connect(
    @Query('platform') platform: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    if (!platform || !userId) {
      throw new HttpException('platform and userId are required', HttpStatus.BAD_REQUEST);
    }

    const platformEnum = platform.toUpperCase() as Platform;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    // Ensure user exists (auto-create for demo/development)
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@socialdrop.local`, name: userId },
    });

    // For platforms with static env credentials, save directly to DB
    const staticCreds = await this.resolveStaticCredentials(platformEnum);
    if (staticCreds) {
      await this.prisma.integration.upsert({
        where: {
          userId_platform_profileId: {
            userId,
            platform: platformEnum,
            profileId: staticCreds.profileId,
          },
        },
        update: {
          accessToken: staticCreds.accessToken,
          accountName: staticCreds.accountName,
        },
        create: {
          userId,
          platform: platformEnum,
          accessToken: staticCreds.accessToken,
          profileId: staticCreds.profileId,
          accountName: staticCreds.accountName,
        },
      });
      return res.redirect(`${frontendUrl}/integrations?connected=${platform}`);
    }

    // OAuth flow for platforms without static credentials
    if (!this.integrationManager.hasProvider(platformEnum)) {
      throw new HttpException(`Unknown platform: ${platform}`, HttpStatus.BAD_REQUEST);
    }

    const provider = this.integrationManager.getProvider(platformEnum);
    const authUrl = provider.generateAuthUrl(userId);
    res.redirect(authUrl);
  }

  private async resolveStaticCredentials(
    platform: Platform,
  ): Promise<{ profileId: string; accessToken: string; accountName: string } | null> {
    const env = process.env;

    if (
      (platform === 'FACEBOOK' || platform === 'INSTAGRAM') &&
      env.FACEBOOK_ACCESS_TOKEN &&
      env.FACEBOOK_PAGE_ID &&
      !env.FACEBOOK_ACCESS_TOKEN.startsWith('PLACEHOLDER')
    ) {
      // Always exchange user token → page access token so posting works
      const pageId = env.FACEBOOK_PAGE_ID;
      const userToken = env.FACEBOOK_ACCESS_TOKEN;
      let pageToken = userToken;
      let pageName = platform === 'FACEBOOK' ? 'Facebook Page' : 'Instagram Business';

      try {
        const r = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}?fields=access_token,name&access_token=${userToken}`,
        );
        if (r.ok) {
          const d = await r.json() as { access_token?: string; name?: string };
          if (d.access_token) { pageToken = d.access_token; }
          if (d.name && platform === 'FACEBOOK') { pageName = d.name; }
        }
      } catch { /* use original token if exchange fails */ }

      if (platform === 'FACEBOOK') {
        return { profileId: pageId, accessToken: pageToken, accountName: pageName };
      }
      // INSTAGRAM uses the same page token but with the Instagram account ID
      if (env.INSTAGRAM_ACCOUNT_ID) {
        return { profileId: env.INSTAGRAM_ACCOUNT_ID, accessToken: pageToken, accountName: 'Instagram Business' };
      }
    }

    return null;
  }

  @Get(':platform/callback')
  @ApiOperation({ summary: 'OAuth callback handler for a platform' })
  async callback(
    @Param('platform') platform: string,
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    if (!code || !userId) {
      throw new HttpException('Missing code or state', HttpStatus.BAD_REQUEST);
    }

    const platformEnum = platform.toUpperCase() as Platform;
    const provider = this.integrationManager.getProvider(platformEnum);

    // Ensure user exists
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@socialdrop.local`, name: userId },
    });

    const authResult = await provider.authenticate(code, userId);

    await this.prisma.integration.upsert({
      where: {
        userId_platform_profileId: {
          userId,
          platform: platformEnum,
          profileId: authResult.profileId,
        },
      },
      update: {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        tokenExpiry: authResult.tokenExpiry,
        accountName: authResult.accountName,
      },
      create: {
        userId,
        platform: platformEnum,
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        tokenExpiry: authResult.tokenExpiry,
        profileId: authResult.profileId,
        accountName: authResult.accountName,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:4200';
    res.redirect(`${frontendUrl}/integrations?connected=${platform}`);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Verify if an integration token is still valid' })
  async checkStatus(@Param('id') id: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { id },
      select: { id: true, platform: true, accountName: true, tokenExpiry: true },
    });
    if (!integration) throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);

    const isExpired = integration.tokenExpiry
      ? integration.tokenExpiry.getTime() < Date.now()
      : false;

    return {
      id: integration.id,
      platform: integration.platform,
      accountName: integration.accountName,
      isExpired,
      tokenExpiry: integration.tokenExpiry,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Disconnect a platform integration' })
  async disconnect(@Param('id') id: string) {
    const integration = await this.prisma.integration.findUnique({ where: { id } });
    if (!integration) throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);

    await this.prisma.integration.delete({ where: { id } });
    return { message: 'Integration disconnected', id };
  }
}
