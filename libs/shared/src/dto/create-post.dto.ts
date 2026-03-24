import { IsString, IsDateString, IsArray, IsEnum, IsOptional } from 'class-validator';
import { Platform } from '../enums/index.js';

export class CreatePostDto {
  @IsString()
  content!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms!: Platform[];

  /** IDs of already-uploaded Media records */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];

  /** External public URLs (images/videos reachable by provider APIs) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];
}
