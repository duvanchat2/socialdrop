import { Platform } from '../enums/index.js';

export interface CsvRow {
  caption: string;
  scheduledDate: Date;
  platforms: Platform[];
  mediaFiles: string[];
}
