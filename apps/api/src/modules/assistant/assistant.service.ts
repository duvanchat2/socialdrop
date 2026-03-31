import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly client: Anthropic;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async chat(message: string): Promise<string> {
    this.logger.log(`Assistant chat: "${message.slice(0, 50)}..."`);

    const response = await this.client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system:
        'You are SocialDrop AI, a social media content assistant. Help users write engaging captions, plan posts, and improve their social media presence. Be concise and creative. Respond in the same language the user writes in.',
      messages: [{ role: 'user', content: message }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    return content.text;
  }
}
