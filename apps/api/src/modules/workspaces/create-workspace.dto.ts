import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Cliente XYZ' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
