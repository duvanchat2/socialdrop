import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UsageService } from './usage.service.js';

@ApiTags('usage')
@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  @ApiOperation({ summary: 'Current month usage/quota for the authenticated user' })
  getUsage(@CurrentUser() userId: string) {
    return this.usageService.getUsage(userId);
  }
}
