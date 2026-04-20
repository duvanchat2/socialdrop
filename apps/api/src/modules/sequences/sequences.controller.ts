import {
  Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SequencesService, CreateSequenceDto } from './sequences.service.js';

@ApiTags('sequences')
@Controller('sequences')
export class SequencesController {
  constructor(private readonly sequencesService: SequencesService) {}

  @Get()
  findAll(@Query('userId') userId = 'demo-user') {
    return this.sequencesService.findAll(userId);
  }

  @Post()
  create(@Query('userId') userId = 'demo-user', @Body() dto: CreateSequenceDto) {
    return this.sequencesService.create(userId, dto);
  }

  @Post(':id/enroll/:contactId')
  @ApiOperation({ summary: 'Enroll a contact in a sequence' })
  enroll(@Param('id') id: string, @Param('contactId') contactId: string) {
    return this.sequencesService.enroll(id, contactId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Query('userId') userId = 'demo-user') {
    return this.sequencesService.remove(id, userId);
  }
}
