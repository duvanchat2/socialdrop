import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class ConfigureDriveDto {
  @IsString()
  folderId!: string;

  @IsOptional()
  @IsString()
  folderName?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  pollingInterval?: number;
}
