import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { PrismaService } from '@socialdrop/prisma';
import { DriveService } from './drive.service.js';
import { ConfigureDriveDto } from '@socialdrop/shared';

@Controller('drive')
export class DriveController {
  private readonly logger = new Logger(DriveController.name);

  constructor(
    private readonly driveService: DriveService,
    private readonly prisma: PrismaService,
  ) {}

  /** Returns the Google OAuth URL as JSON (for frontend use) */
  @Get('auth-url')
  @UseGuards(WorkspaceGuard)
  authUrl(@ActiveWorkspace() workspaceId: string) {
    const url = this.driveService.generateAuthUrl(workspaceId);
    return { url };
  }

  /** Redirects browser to Google OAuth */
  @Get('auth')
  @UseGuards(WorkspaceGuard)
  auth(@ActiveWorkspace() workspaceId: string, @Res() res: Response): void {
    try {
      const url = this.driveService.generateAuthUrl(workspaceId);
      res.redirect(url);
    } catch (err: any) {
      this.logger.error('Error generating Drive auth URL', err);
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(`${frontendUrl}/drive?error=auth_failed&message=${encodeURIComponent(err?.message ?? 'Unknown error')}`);
    }
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') workspaceId: string,
    @Query('error') oauthError: string,
    @CurrentUser() userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    // Google returns ?error=access_denied when user cancels or app is unverified
    if (oauthError) {
      this.logger.warn(`Drive OAuth error for workspace ${workspaceId}: ${oauthError}`);
      const msg = oauthError === 'access_denied'
        ? 'Acceso denegado. Si la app no está verificada, agrega tu email como usuario de prueba en Google Cloud Console → APIs & Services → OAuth consent screen → Test users.'
        : `Error de Google: ${oauthError}`;
      res.redirect(`${frontendUrl}/drive?error=${oauthError}&message=${encodeURIComponent(msg)}`);
      return;
    }

    if (!code || !workspaceId) {
      res.redirect(`${frontendUrl}/drive?error=missing_params&message=${encodeURIComponent('Faltan parámetros de OAuth')}`);
      return;
    }

    // Manual membership check — this is an external redirect from Google, so
    // it carries no X-Workspace-Id header for WorkspaceGuard.
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this workspace');

    try {
      await this.driveService.handleOAuthCallback(code, workspaceId);
      this.logger.log(`[Drive] OAuth callback OK — token saved to DB for workspaceId=${workspaceId}`);
      res.redirect(`${frontendUrl}/drive?connected=true`);
    } catch (err: any) {
      this.logger.error(`Drive OAuth callback error for workspace ${workspaceId}`, err);
      const msg = err?.message ?? 'Error desconocido al conectar Google Drive';
      res.redirect(`${frontendUrl}/drive?error=callback_failed&message=${encodeURIComponent(msg)}`);
    }
  }

  @Post('configure')
  @UseGuards(WorkspaceGuard)
  async configure(
    @ActiveWorkspace() workspaceId: string,
    @Body() dto: ConfigureDriveDto,
  ) {
    return this.driveService.configureDriveFolder(workspaceId, dto);
  }

  @Get('status')
  @UseGuards(WorkspaceGuard)
  async status(@ActiveWorkspace() workspaceId: string) {
    return this.driveService.getSyncStatus(workspaceId);
  }

  @Post('sync/:configId')
  async triggerSync(@Param('configId') configId: string) {
    return this.driveService.triggerManualSync(configId);
  }
}
