import { Controller, Get, Delete, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DebugLogService } from './debug-log.service.js';

@ApiTags('debug')
@Controller('debug')
export class DebugController {
  constructor(private readonly debugLog: DebugLogService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get last N debug log entries for a user' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLogs(
    @CurrentUser() userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.debugLog.getLogs(userId, Math.min(limit, 200));
  }

  @Delete('logs')
  @ApiOperation({ summary: 'Clear debug logs for a user' })
  @ApiQuery({ name: 'userId', required: false })
  clearLogs(@CurrentUser() userId: string) {
    return this.debugLog.clearLogs(userId);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get persisted critical events for a user (survives Redis rotation)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getEvents(
    @CurrentUser() userId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return this.debugLog.getEventLogs(userId, Math.min(limit, 500));
  }
}
