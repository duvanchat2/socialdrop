import { IsString, IsDateString, IsArray, IsEnum, IsOptional } from 'class-validator';
import { Platform } from '../enums/index.js';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms?: Platform[];
}
