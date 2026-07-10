import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UsageService } from '../usage/usage.service.js';
import { AssistantService } from './assistant.service.js';
import { ChatDto } from './dto/chat.dto.js';

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly usageService: UsageService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send a message to the AI assistant and receive a reply' })
  async chat(@CurrentUser() userId: string, @Body() dto: ChatDto): Promise<{ reply: string }> {
    await this.usageService.consume(userId, 'assistant_message');
    const reply = await this.assistantService.chat(dto.message);
    return { reply };
  }
}
