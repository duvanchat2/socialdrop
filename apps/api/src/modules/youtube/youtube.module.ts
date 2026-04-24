import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { YoutubeService } from './youtube.service.js';
import { YoutubeController } from './youtube.controller.js';

@Module({
  imports: [ConfigModule],
  controllers: [YoutubeController],
  providers: [YoutubeService],
  exports: [YoutubeService],
})
export class YoutubeModule {}
