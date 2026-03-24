import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ContentService } from './content.service.js';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @ApiOperation({ summary: 'List content items' })
  findAll(
    @Query('userId') userId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.contentService.findAll(userId ?? 'demo-user', type, status);
  }

  @Post()
  @ApiOperation({ summary: 'Create content item' })
  create(@Query('userId') userId: string, @Body() dto: any) {
    return this.contentService.create(userId ?? 'demo-user', dto);
  }

  @Get('drive-files')
  @ApiOperation({ summary: 'List files from configured Drive folder' })
  getDriveFiles(@Query('userId') userId: string) {
    return this.contentService.getDriveFiles(userId ?? 'demo-user');
  }

  @Post('schedule-all')
  @ApiOperation({ summary: 'Schedule all drafts with scheduledAt set' })
  scheduleAll(@Query('userId') userId: string) {
    return this.contentService.scheduleAll(userId ?? 'demo-user');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update content item (inline editing)' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.contentService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.contentService.remove(id);
  }

  @Post(':id/generate')
  @ApiOperation({ summary: 'Trigger n8n webhook to generate copy' })
  generateCopy(@Param('id') id: string) {
    return this.contentService.generateCopy(id);
  }

  @Post(':id/copy-callback')
  @ApiOperation({ summary: 'Callback from n8n with generated copy' })
  copyCallback(@Param('id') id: string, @Body() body: any) {
    return this.contentService.handleCopyCallback(id, body);
  }
}
