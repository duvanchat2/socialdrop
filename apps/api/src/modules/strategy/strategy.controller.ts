import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StrategyService, DayConfig } from './strategy.service.js';

@ApiTags('strategy')
@Controller('strategy')
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get()
  @ApiOperation({ summary: 'Get content strategy for user' })
  get(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.strategyService.get(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save content strategy' })
  save(@Query('userId') userId: string, @Body() body: { dayConfigs: DayConfig[] }) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.strategyService.save(userId, body.dayConfigs);
  }
}
