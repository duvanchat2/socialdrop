import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller.js';
import { FlowsService } from './flows.service.js';
import { FlowEngine } from './flow.engine.js';

@Module({
  controllers: [FlowsController],
  providers: [FlowsService, FlowEngine],
  exports: [FlowsService, FlowEngine],
})
export class FlowsModule {}
