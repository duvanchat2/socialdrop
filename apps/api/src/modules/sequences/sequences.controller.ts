import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { SequencesService, CreateSequenceDto } from './sequences.service.js';

@ApiTags('sequences')
@Controller('sequences')
@UseGuards(WorkspaceGuard)
export class SequencesController {
  constructor(private readonly sequencesService: SequencesService) {}

  @Get()
  findAll(@ActiveWorkspace() workspaceId: string) {
    return this.sequencesService.findAll(workspaceId);
  }

  @Post()
  create(@ActiveWorkspace() workspaceId: string, @Body() dto: CreateSequenceDto) {
    return this.sequencesService.create(workspaceId, dto);
  }

  @Post(':id/enroll/:contactId')
  @ApiOperation({ summary: 'Enroll a contact in a sequence' })
  enroll(@Param('id') id: string, @Param('contactId') contactId: string) {
    return this.sequencesService.enroll(id, contactId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.sequencesService.remove(id, workspaceId);
  }
}
