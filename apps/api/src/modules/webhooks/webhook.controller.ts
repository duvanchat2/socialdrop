import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UnauthorizedException,
  Header,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/auth.public.js';
import { WebhookService } from './webhook.service.js';

@ApiTags('webhooks')
@Controller('webhooks')
@Public()
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

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
  receiveMeta(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: any,
  ): { status: string } {
    if (!this.webhookService.verifySignature(req.rawBody, signature)) {
      throw new UnauthorizedException('Invalid or missing webhook signature');
    }

    // Fire-and-forget — Meta expects a fast 200, not a response gated on flow execution.
    this.webhookService.processEvent(body).catch((e) =>
      this.logger.error(`processEvent failed: ${(e as Error).message}`),
    );
    return { status: 'ok' };
  }
}
