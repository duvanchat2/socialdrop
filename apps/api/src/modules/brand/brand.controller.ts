import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BrandService } from './brand.service.js';
import type { BrandProfileDto } from './brand.service.js';

@ApiTags('brand')
@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'Get brand profile for user' })
  get(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.brandService.get(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save brand profile' })
  save(@Query('userId') userId: string, @Body() dto: BrandProfileDto) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.brandService.save(userId, dto);
  }
}
