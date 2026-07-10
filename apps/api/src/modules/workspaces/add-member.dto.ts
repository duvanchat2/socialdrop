import { IsEmail, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddMemberDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['OWNER', 'MEMBER'], example: 'MEMBER' })
  @IsIn(['OWNER', 'MEMBER'])
  role!: 'OWNER' | 'MEMBER';
}
