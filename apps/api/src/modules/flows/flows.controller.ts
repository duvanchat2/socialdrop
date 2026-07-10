import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FlowsService, CreateFlowDto, UpdateFlowDto } from './flows.service.js';

@ApiTags('flows')
@Controller('flows')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  @ApiQuery({ name: 'userId', required: false })
  findAll(@CurrentUser() userId: string) {
    return this.flowsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.flowsService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateFlowDto) {
    return this.flowsService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateFlowDto,
  ) {
    return this.flowsService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.flowsService.remove(id, userId);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle flow active/inactive' })
  toggle(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.flowsService.toggle(id, userId);
  }
}
