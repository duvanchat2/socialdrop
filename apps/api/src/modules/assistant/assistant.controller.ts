import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service.js';
import { ChatDto } from './dto/chat.dto.js';

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send a message to the AI assistant and receive a reply' })
  async chat(@Body() dto: ChatDto): Promise<{ reply: string }> {
    const reply = await this.assistantService.chat(dto.message);
    return { reply };
  }
}
