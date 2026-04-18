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
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Platform } from '@socialdrop/shared';
import { AssignSlotDto, CreateQueueSlotDto } from './dto/queue-slot.dto.js';
import { QueueService } from './queue.service.js';

@ApiTags('queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get()
  @ApiOperation({ summary: 'List queue slots for a user' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'platform', required: false })
  list(
    @Query('userId') userId: string,
    @Query('platform') platform?: Platform,
  ) {
    return this.queue.list(userId, platform);
  }

  @Post()
  @ApiOperation({ summary: 'Create a queue slot' })
  create(@Body() dto: CreateQueueSlotDto) {
    return this.queue.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a queue slot' })
  remove(@Param('id') id: string) {
    return this.queue.remove(id);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign a post to its next free queue slot' })
  assign(@Body() dto: AssignSlotDto) {
    return this.queue.assign(dto.postId);
  }
}
