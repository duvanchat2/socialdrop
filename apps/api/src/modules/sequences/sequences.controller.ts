import {
  Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SequencesService, CreateSequenceDto } from './sequences.service.js';

@ApiTags('sequences')
@Controller('sequences')
export class SequencesController {
  constructor(private readonly sequencesService: SequencesService) {}

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.sequencesService.findAll(userId);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateSequenceDto) {
    return this.sequencesService.create(userId, dto);
  }

  @Post(':id/enroll/:contactId')
  @ApiOperation({ summary: 'Enroll a contact in a sequence' })
  enroll(@Param('id') id: string, @Param('contactId') contactId: string) {
    return this.sequencesService.enroll(id, contactId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.sequencesService.remove(id, userId);
  }
}
