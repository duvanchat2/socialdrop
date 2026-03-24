import {
  Controller, Get, Post, Patch, Body, Param, Query, Delete, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PostsService } from './posts.service.js';
import { CreatePostDto, UpdatePostDto } from '@socialdrop/shared';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and schedule a post' })
  @ApiResponse({ status: 201, description: 'Post created' })
  create(@Query('userId') userId: string, @Body() dto: CreatePostDto) {
    return this.postsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List posts with optional filters' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('userId') userId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postsService.findAll(userId, {
      status: status as any,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get posts for calendar view' })
  calendar(
    @Query('userId') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.postsService.getCalendar(userId, new Date(from), new Date(to));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post detail with integrations' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update post caption/date/platforms' })
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel and delete a post' })
  remove(@Param('id') id: string) {
    return this.postsService.remove(id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed post' })
  retry(@Param('id') id: string) {
    return this.postsService.retry(id);
  }
}
