import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Platform } from '@socialdrop/shared';

export class CreateQueueSlotDto {
  @IsString()
  userId!: string;

  @IsEnum(Platform)
  platform!: Platform;

  /** 0 = Sunday, 6 = Saturday */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(23)
  hour!: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignSlotDto {
  @IsString()
  postId!: string;
}
