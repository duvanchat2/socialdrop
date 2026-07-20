import {
  Controller, Get, Delete, Query, Param, Res, UseGuards, HttpException, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
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
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'List connected integrations for the active workspace' })
  async getUserIntegrations(@ActiveWorkspace() workspaceId: string) {
    return this.prisma.integration.findMany({
      where: { workspaceId },
      select: {
        id: true,
        platform: true,
        accountName: true,
        profileId: true,
        tokenExpiry: true,
        needsReauth: true,
        createdAt: true,
      },
    });
  }

  @Get('connect')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Start OAuth flow or save static env credentials for a platform' })
  async connect(
    @Query('platform') platform: string,
    @ActiveWorkspace() workspaceId: string,
    @Res() res: Response,
  ) {
    if (!platform) {
      throw new HttpException('platform is required', HttpStatus.BAD_REQUEST);
    }

    const platformEnum = platform.toUpperCase() as Platform;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    // For platforms with static env credentials, save directly to DB
    const staticCreds = await this.resolveStaticCredentials(platformEnum);
    if (staticCreds) {
      await this.prisma.integration.upsert({
        where: {
          workspaceId_platform_profileId: {
            workspaceId,
            platform: platformEnum,
            profileId: staticCreds.profileId,
          },
        },
        update: {
          accessToken: staticCreds.accessToken,
          accountName: staticCreds.accountName,
          needsReauth: false,
        },
        create: {
          workspaceId,
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
    // workspaceId travels through the OAuth `state` param — it's the only
    // way to recover tenant context on the callback, since that's an
    // external redirect and won't carry our X-Workspace-Id header.
    const authUrl = provider.generateAuthUrl(workspaceId);
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
    @Query('state') workspaceId: string,
    @CurrentUser() userId: string,
    @Res() res: Response,
  ) {
    if (!code || !workspaceId) {
      throw new HttpException('Missing code or state', HttpStatus.BAD_REQUEST);
    }

    // Manual membership check — this is an external redirect from the OAuth
    // provider, so it carries no X-Workspace-Id header for WorkspaceGuard.
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this workspace');

    const platformEnum = platform.toUpperCase() as Platform;
    const provider = this.integrationManager.getProvider(platformEnum);

    const authResult = await provider.authenticate(code, workspaceId);

    await this.prisma.integration.upsert({
      where: {
        workspaceId_platform_profileId: {
          workspaceId,
          platform: platformEnum,
          profileId: authResult.profileId,
        },
      },
      update: {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        tokenExpiry: authResult.tokenExpiry,
        accountName: authResult.accountName,
        needsReauth: false,
      },
      create: {
        workspaceId,
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
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Verify if an integration token is still valid' })
  async checkStatus(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, workspaceId },
      select: { id: true, platform: true, accountName: true, tokenExpiry: true, needsReauth: true },
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
      needsReauth: integration.needsReauth,
    };
  }

  @Get(':id/permissions')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'List Meta permissions actually granted for a connected account' })
  async checkPermissions(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, workspaceId },
      select: { id: true, platform: true, accessToken: true },
    });
    if (!integration) throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    if (integration.platform !== 'FACEBOOK' && integration.platform !== 'INSTAGRAM') {
      return { granted: [], declined: [], note: 'Permission listing only applies to Meta platforms' };
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/me/permissions?access_token=${integration.accessToken}`,
      );
      const data = await res.json() as { data?: Array<{ permission: string; status: 'granted' | 'declined' }> };
      const perms = data.data ?? [];
      return {
        granted: perms.filter((p) => p.status === 'granted').map((p) => p.permission),
        declined: perms.filter((p) => p.status === 'declined').map((p) => p.permission),
        hasMessagingScopes: perms.some(
          (p) => p.status === 'granted' && /messag|comment|engagement/.test(p.permission),
        ),
      };
    } catch {
      throw new HttpException('Could not fetch permissions from Meta', HttpStatus.BAD_GATEWAY);
    }
  }

  @Delete(':id')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Disconnect a platform integration' })
  async disconnect(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    const integration = await this.prisma.integration.findFirst({ where: { id, workspaceId } });
    if (!integration) throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);

    await this.prisma.integration.delete({ where: { id } });
    return { message: 'Integration disconnected', id };
  }
}
