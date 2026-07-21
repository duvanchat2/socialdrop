import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DeadLetterService } from './dead-letter.service.js';

@ApiTags('debug')
@Controller('debug/dead-letter')
export class DeadLetterController {
  constructor(private readonly deadLetter: DeadLetterService) {}

  @Get()
  @ApiOperation({ summary: 'List jobs that exhausted their retries (not yet requeued)' })
  list() {
    return this.deadLetter.list();
  }

  @Post(':id/requeue')
  @ApiOperation({ summary: 'Requeue a dead-letter job onto the post-scheduler queue' })
  requeue(@Param('id') id: string) {
    return this.deadLetter.requeue(id);
  }
}
