import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { Platform } from '@socialdrop/shared';
import { AssignSlotDto, CreateQueueSlotDto } from './dto/queue-slot.dto.js';
import { QueueService } from './queue.service.js';

@ApiTags('queue')
@Controller('queue')
@UseGuards(WorkspaceGuard)
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get()
  @ApiOperation({ summary: 'List queue slots for the active workspace' })
  @ApiQuery({ name: 'platform', required: false })
  list(
    @ActiveWorkspace() workspaceId: string,
    @Query('platform') platform?: Platform,
  ) {
    return this.queue.list(workspaceId, platform);
  }

  @Post()
  @ApiOperation({ summary: 'Create a queue slot' })
  create(@ActiveWorkspace() workspaceId: string, @Body() dto: CreateQueueSlotDto) {
    return this.queue.create(workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a queue slot' })
  remove(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.queue.remove(id, workspaceId);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign a post to its next free queue slot' })
  assign(@Body() dto: AssignSlotDto) {
    return this.queue.assign(dto.postId);
  }
}
