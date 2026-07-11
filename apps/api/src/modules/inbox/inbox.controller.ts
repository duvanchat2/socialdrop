import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InboxService } from './inbox.service.js';

@ApiTags('inbox')
@Controller('inbox')
@UseGuards(WorkspaceGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations/contacts' })
  getConversations(@ActiveWorkspace() workspaceId: string) {
    return this.inboxService.getConversations(workspaceId);
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
