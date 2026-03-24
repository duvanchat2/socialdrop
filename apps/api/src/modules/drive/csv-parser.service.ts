import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Platform } from '@socialdrop/shared';
import type { CsvRow } from '@socialdrop/shared';

const VALID_PLATFORMS = new Set(Object.values(Platform));

@Injectable()
export class CsvParserService {
  private readonly logger = new Logger(CsvParserService.name);

  async parseCsvBuffer(buffer: Buffer): Promise<CsvRow[]> {
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const rows: CsvRow[] = [];

    for (const [index, record] of records.entries()) {
      try {
        const row = this.parseRow(record, index);
        if (row) rows.push(row);
      } catch (error) {
        this.logger.warn(
          `Skipping CSV row ${index + 1}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`Parsed ${rows.length} valid rows from CSV`);
    return rows;
  }

  private parseRow(
    record: Record<string, string>,
    index: number,
  ): CsvRow | null {
    const caption = record['caption'];
    if (!caption) {
      throw new Error('Missing required field: caption');
    }

    const scheduledDateStr = record['scheduled_date'];
    if (!scheduledDateStr) {
      throw new Error('Missing required field: scheduled_date');
    }

    const scheduledDate = new Date(scheduledDateStr);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error(`Invalid date: ${scheduledDateStr}`);
    }

    const platformsStr = record['platforms'] ?? '';
    const platforms = platformsStr
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter((p) => VALID_PLATFORMS.has(p as Platform)) as Platform[];

    if (platforms.length === 0) {
      throw new Error(`No valid platforms found: ${platformsStr}`);
    }

    const mediaFilesStr = record['media_files'] ?? '';
    const mediaFiles = mediaFilesStr
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    return { caption, scheduledDate, platforms, mediaFiles };
  }
}
