import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { drive_v3 } from 'googleapis';
import { PrismaService } from '@socialdrop/prisma';
import { ConfigureDriveDto } from '@socialdrop/shared';
import { CsvParserService } from './csv-parser.service.js';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly csvParser: CsvParserService,
    @InjectQueue('drive-sync') private readonly driveSyncQueue: Queue,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
  ) {}

  generateAuthUrl(userId: string): string {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.config.get<string[]>('google.scopes'),
      state: userId,
    });
  }

  async handleOAuthCallback(code: string, userId: string): Promise<void> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    await this.prisma.driveConfig.upsert({
      where: {
        userId_folderId: { userId, folderId: '__pending__' },
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? '',
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
      },
      create: {
        userId,
        folderId: '__pending__',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? '',
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        syncEnabled: false,
      },
    });

    this.logger.log(`OAuth tokens stored for user ${userId}`);
  }

  async configureDriveFolder(userId: string, dto: ConfigureDriveDto) {
    const pending = await this.prisma.driveConfig.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!pending) {
      throw new Error('No Drive connection found. Please authenticate first.');
    }

    const config = await this.prisma.driveConfig.upsert({
      where: {
        userId_folderId: { userId, folderId: dto.folderId },
      },
      update: {
        folderName: dto.folderName,
        pollingInterval: dto.pollingInterval ?? 300,
        syncEnabled: true,
        accessToken: pending.accessToken,
        refreshToken: pending.refreshToken,
        tokenExpiry: pending.tokenExpiry,
      },
      create: {
        userId,
        folderId: dto.folderId,
        folderName: dto.folderName,
        accessToken: pending.accessToken,
        refreshToken: pending.refreshToken,
        tokenExpiry: pending.tokenExpiry,
        pollingInterval: dto.pollingInterval ?? 300,
        syncEnabled: true,
      },
    });

    // Remove old repeatable job if exists
    const existingJobs = await this.driveSyncQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      if (job.id === `drive-poll-${config.id}`) {
        await this.driveSyncQueue.removeRepeatableByKey(job.key);
      }
    }

    // Add repeatable polling job
    await this.driveSyncQueue.add(
      'poll',
      { configId: config.id, type: 'poll' },
      {
        repeat: { every: config.pollingInterval * 1000 },
        jobId: `drive-poll-${config.id}`,
      },
    );

    this.logger.log(
      `Drive folder ${dto.folderId} configured for user ${userId}, polling every ${config.pollingInterval}s`,
    );

    return config;
  }

  async getSyncStatus(userId: string) {
    const [configs, anyConfig] = await Promise.all([
      this.prisma.driveConfig.findMany({
        where: { userId, syncEnabled: true },
        select: {
          id: true,
          folderId: true,
          folderName: true,
          syncEnabled: true,
          lastSyncAt: true,
          pollingInterval: true,
        },
      }),
      this.prisma.driveConfig.findFirst({ where: { userId } }),
    ]);
    return { isConnected: !!anyConfig, configs };
  }

  async triggerManualSync(configId: string) {
    await this.driveSyncQueue.add('full-sync', {
      configId,
      type: 'full-sync',
    });
    return { message: 'Sync job queued', configId };
  }

  async pollForChanges(configId: string) {
    const driveConfig = await this.prisma.driveConfig.findUniqueOrThrow({
      where: { id: configId },
    });

    const auth = await this.getAuthenticatedClient(driveConfig);
    const drive = google.drive({ version: 'v3', auth });

    // Get start page token if we don't have one
    if (!driveConfig.lastPageToken) {
      const startToken = await drive.changes.getStartPageToken();
      await this.prisma.driveConfig.update({
        where: { id: configId },
        data: { lastPageToken: startToken.data.startPageToken },
      });
      this.logger.log(`Initialized page token for config ${configId}`);
      return { changes: 0, newFiles: [] };
    }

    const response = await drive.changes.list({
      pageToken: driveConfig.lastPageToken,
      spaces: 'drive',
      fields:
        'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,parents,modifiedTime))',
    });

    const relevantChanges =
      response.data.changes?.filter(
        (change) =>
          !change.removed &&
          change.file?.parents?.includes(driveConfig.folderId),
      ) ?? [];

    const newFiles: string[] = [];
    for (const change of relevantChanges) {
      const file = change.file!;
      if (file.mimeType === 'text/csv') {
        await this.processCsvFile(drive, auth, file, driveConfig);
      }
      newFiles.push(file.name!);
    }

    await this.prisma.driveConfig.update({
      where: { id: configId },
      data: {
        lastPageToken:
          response.data.newStartPageToken ?? response.data.nextPageToken,
        lastSyncAt: new Date(),
      },
    });

    this.logger.log(
      `Poll for config ${configId}: ${relevantChanges.length} changes, ${newFiles.length} new files`,
    );
    return { changes: relevantChanges.length, newFiles };
  }

  async syncFolder(configId: string) {
    const driveConfig = await this.prisma.driveConfig.findUniqueOrThrow({
      where: { id: configId },
    });

    const auth = await this.getAuthenticatedClient(driveConfig);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: `'${driveConfig.folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,modifiedTime)',
      orderBy: 'modifiedTime desc',
    });

    const files = response.data.files ?? [];
    const csvFiles = files.filter((f) => f.mimeType === 'text/csv');
    let postsCreated = 0;

    for (const csvFile of csvFiles) {
      const created = await this.processCsvFile(
        drive,
        auth,
        csvFile as drive_v3.Schema$File,
        driveConfig,
      );
      postsCreated += created;
    }

    await this.prisma.driveConfig.update({
      where: { id: configId },
      data: { lastSyncAt: new Date() },
    });

    this.logger.log(
      `Full sync for config ${configId}: ${files.length} files, ${postsCreated} posts created`,
    );
    return { totalFiles: files.length, csvFiles: csvFiles.length, postsCreated };
  }

  private async processCsvFile(
    drive: drive_v3.Drive,
    auth: OAuth2Client,
    file: drive_v3.Schema$File,
    driveConfig: { id: string; userId: string; folderId: string },
  ): Promise<number> {
    const response = await drive.files.get(
      { fileId: file.id!, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);
    const rows = await this.csvParser.parseCsvBuffer(buffer);

    let created = 0;
    for (const row of rows) {
      // Check if post already exists (by driveSourceId)
      const driveSourceId = `${file.id}:${row.caption.slice(0, 50)}`;
      const existing = await this.prisma.post.findFirst({
        where: { driveSourceId, userId: driveConfig.userId },
      });
      if (existing) continue;

      // Resolve media files from the same Drive folder
      const mediaRecords = [];
      for (const mediaFileName of row.mediaFiles) {
        const mediaSearch = await drive.files.list({
          q: `'${driveConfig.folderId}' in parents and name = '${mediaFileName}' and trashed = false`,
          fields: 'files(id,name,mimeType,size)',
        });
        const mediaFile = mediaSearch.data.files?.[0];
        if (mediaFile) {
          const isVideo =
            mediaFile.mimeType?.startsWith('video/') ?? false;
          mediaRecords.push({
            url: `drive://${mediaFile.id}`,
            mimeType: mediaFile.mimeType ?? 'application/octet-stream',
            fileName: mediaFile.name ?? mediaFileName,
            fileSize: mediaFile.size
              ? parseInt(mediaFile.size, 10)
              : null,
            mediaType: isVideo ? 'VIDEO' as const : 'IMAGE' as const,
            driveFileId: mediaFile.id,
          });
        }
      }

      // Find matching integrations for the user
      const integrations = await this.prisma.integration.findMany({
        where: {
          userId: driveConfig.userId,
          platform: { in: row.platforms },
        },
      });

      await this.prisma.post.create({
        data: {
          userId: driveConfig.userId,
          content: row.caption,
          scheduledAt: row.scheduledDate,
          status: 'SCHEDULED',
          driveSourceId,
          media: {
            create: mediaRecords,
          },
          integrations: {
            create: integrations.map((int) => ({
              integrationId: int.id,
              status: 'PENDING',
            })),
          },
        },
      });

      // Ensure the scheduler picks up this post when its time arrives
      await this.schedulerQueue.add(
        'scan',
        { type: 'scan' },
        { repeat: { every: 60000 }, jobId: 'global-scan', deduplication: { id: 'global-scan' } },
      );

      created++;
    }

    return created;
  }

  private createOAuth2Client(): OAuth2Client {
    return new google.auth.OAuth2(
      this.config.get<string>('google.clientId'),
      this.config.get<string>('google.clientSecret'),
      this.config.get<string>('google.redirectUri'),
    );
  }

  private async getAuthenticatedClient(driveConfig: {
    id: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiry: Date | null;
  }): Promise<OAuth2Client> {
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: driveConfig.accessToken,
      refresh_token: driveConfig.refreshToken,
      expiry_date: driveConfig.tokenExpiry?.getTime(),
    });

    // Check if token is expired and refresh
    if (
      driveConfig.tokenExpiry &&
      driveConfig.tokenExpiry.getTime() < Date.now()
    ) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await this.prisma.driveConfig.update({
        where: { id: driveConfig.id },
        data: {
          accessToken: credentials.access_token!,
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
      });
      this.logger.log(`Refreshed token for drive config ${driveConfig.id}`);
    }

    return oauth2Client;
  }
}
