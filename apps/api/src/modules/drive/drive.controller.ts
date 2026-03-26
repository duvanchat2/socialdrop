import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DriveService } from './drive.service.js';
import { ConfigureDriveDto } from '@socialdrop/shared';

@Controller('drive')
export class DriveController {
  private readonly logger = new Logger(DriveController.name);

  constructor(private readonly driveService: DriveService) {}

  /** Returns the Google OAuth URL as JSON (for frontend use) */
  @Get('auth-url')
  authUrl(@Query('userId') userId: string) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }
    const url = this.driveService.generateAuthUrl(userId);
    return { url };
  }

  /** Redirects browser to Google OAuth */
  @Get('auth')
  auth(@Query('userId') userId: string, @Res() res: Response): void {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const url = this.driveService.generateAuthUrl(userId);
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
    @Query('state') userId: string,
    @Query('error') oauthError: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    // Google returns ?error=access_denied when user cancels or app is unverified
    if (oauthError) {
      this.logger.warn(`Drive OAuth error for user ${userId}: ${oauthError}`);
      const msg = oauthError === 'access_denied'
        ? 'Acceso denegado. Si la app no está verificada, agrega tu email como usuario de prueba en Google Cloud Console → APIs & Services → OAuth consent screen → Test users.'
        : `Error de Google: ${oauthError}`;
      res.redirect(`${frontendUrl}/drive?error=${oauthError}&message=${encodeURIComponent(msg)}`);
      return;
    }

    if (!code || !userId) {
      res.redirect(`${frontendUrl}/drive?error=missing_params&message=${encodeURIComponent('Faltan parámetros de OAuth')}`);
      return;
    }

    try {
      await this.driveService.handleOAuthCallback(code, userId);
      this.logger.log(`[Drive] OAuth callback OK — token saved to DB for userId=${userId}`);
      res.redirect(`${frontendUrl}/drive?connected=true`);
    } catch (err: any) {
      this.logger.error(`Drive OAuth callback error for user ${userId}`, err);
      const msg = err?.message ?? 'Error desconocido al conectar Google Drive';
      res.redirect(`${frontendUrl}/drive?error=callback_failed&message=${encodeURIComponent(msg)}`);
    }
  }

  @Post('configure')
  async configure(
    @Query('userId') userId: string,
    @Body() dto: ConfigureDriveDto,
  ) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }
    return this.driveService.configureDriveFolder(userId, dto);
  }

  @Get('status')
  async status(@Query('userId') userId: string) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }
    return this.driveService.getSyncStatus(userId);
  }

  @Post('sync/:configId')
  async triggerSync(@Param('configId') configId: string) {
    return this.driveService.triggerManualSync(configId);
  }
}
