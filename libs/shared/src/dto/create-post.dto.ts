import { IsString, IsDateString, IsArray, IsEnum, IsOptional, IsIn } from 'class-validator';
import { Platform, PostStatus } from '../enums/index.js';

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

  /** Override default 'SCHEDULED' status (used for DRAFT + queue-assigned posts) */
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  // ── YouTube-specific metadata ─────────────────────────────────────────────

  /** Video title for YouTube (required when publishing to YouTube) */
  @IsOptional()
  @IsString()
  youtubeTitle?: string;

  /** Long-form description for YouTube (overrides caption if set) */
  @IsOptional()
  @IsString()
  youtubeDescription?: string;

  /** Comma-separated tags for YouTube, e.g. "shorts,tutorial,vlog" */
  @IsOptional()
  @IsString()
  youtubeTags?: string;

  // ── Instagram-specific ────────────────────────────────────────────────────

  /**
   * Instagram publish type.
   * - POST  → single image or carousel
   * - REEL  → short video (default for video uploads)
   * - STORY → ephemeral story (image or video, disappears after 24h)
   */
  @IsOptional()
  @IsIn(['POST', 'REEL', 'STORY'])
  instagramType?: 'POST' | 'REEL' | 'STORY';
}
