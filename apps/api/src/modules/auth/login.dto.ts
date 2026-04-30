import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'my-secure-password' })
  @IsString()
  @MinLength(1)
  password!: string;
}
