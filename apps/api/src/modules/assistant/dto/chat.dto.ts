import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty({ description: 'User message to the AI assistant', example: 'Help me write a caption for a travel photo' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
