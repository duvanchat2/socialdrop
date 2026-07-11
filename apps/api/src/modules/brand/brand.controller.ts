import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BrandService } from './brand.service.js';
import type { BrandProfileDto } from './brand.service.js';

@ApiTags('brand')
@Controller('brand')
@UseGuards(WorkspaceGuard)
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'Get brand profile for the active workspace' })
  get(@ActiveWorkspace() workspaceId: string) {
    return this.brandService.get(workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Save brand profile' })
  save(@ActiveWorkspace() workspaceId: string, @Body() dto: BrandProfileDto) {
    return this.brandService.save(workspaceId, dto);
  }
}
