import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InboxService } from './inbox.service.js';

@ApiTags('inbox')
@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations/contacts' })
  getConversations(@CurrentUser() userId: string) {
    return this.inboxService.getConversations(userId);
  }

  @Post(':threadId/reply')
  @ApiOperation({ summary: 'Send manual reply to a contact' })
  sendReply(
    @Param('threadId') threadId: string,
    @Body('message') message: string,
  ) {
    return this.inboxService.sendReply(threadId, message);
  }
}
