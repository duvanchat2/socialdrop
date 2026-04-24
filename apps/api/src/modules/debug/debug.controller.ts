import { Controller, Get, Delete, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
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
    @Query('userId') userId = 'demo-user',
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.debugLog.getLogs(userId, Math.min(limit, 200));
  }

  @Delete('logs')
  @ApiOperation({ summary: 'Clear debug logs for a user' })
  @ApiQuery({ name: 'userId', required: false })
  clearLogs(@Query('userId') userId = 'demo-user') {
    return this.debugLog.clearLogs(userId);
  }
}
