import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { FlowsService, CreateFlowDto, UpdateFlowDto } from './flows.service.js';

@ApiTags('flows')
@Controller('flows')
@UseGuards(WorkspaceGuard)
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  findAll(@ActiveWorkspace() workspaceId: string) {
    return this.flowsService.findAll(workspaceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.flowsService.findOne(id, workspaceId);
  }

  @Post()
  create(@ActiveWorkspace() workspaceId: string, @Body() dto: CreateFlowDto) {
    return this.flowsService.create(workspaceId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @ActiveWorkspace() workspaceId: string,
    @Body() dto: UpdateFlowDto,
  ) {
    return this.flowsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.flowsService.remove(id, workspaceId);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle flow active/inactive' })
  toggle(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.flowsService.toggle(id, workspaceId);
  }
}
