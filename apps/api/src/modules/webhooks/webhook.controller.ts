import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhookService } from './webhook.service.js';
import { Public } from '../auth/auth.public.js';

@Public()
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get('meta')
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Meta webhook verification' })
  verifyMeta(@Query() query: Record<string, string>): string {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const result = this.webhookService.verifyWebhook(mode, token, challenge);
    if (!result) throw new ForbiddenException('Verify token mismatch');
    return result;
  }

  @Post('meta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Meta webhook events' })
  receiveMeta(@Body() body: any): { status: string } {
    this.webhookService.processEvent(body);
    return { status: 'ok' };
  }
}
