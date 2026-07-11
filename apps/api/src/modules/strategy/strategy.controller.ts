import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StrategyService, DayConfig } from './strategy.service.js';

@ApiTags('strategy')
@Controller('strategy')
@UseGuards(WorkspaceGuard)
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get()
  @ApiOperation({ summary: 'Get content strategy for the active workspace' })
  get(@ActiveWorkspace() workspaceId: string) {
    return this.strategyService.get(workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Save content strategy' })
  save(@ActiveWorkspace() workspaceId: string, @Body() body: { dayConfigs: DayConfig[] }) {
    return this.strategyService.save(workspaceId, body.dayConfigs);
  }
}
