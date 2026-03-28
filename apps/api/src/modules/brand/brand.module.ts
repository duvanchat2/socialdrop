import { Module } from '@nestjs/common';
import { PrismaModule } from '@socialdrop/prisma';
import { BrandController } from './brand.controller.js';
import { BrandService } from './brand.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
