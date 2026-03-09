import { Module } from '@nestjs/common';
import { AIEventsService } from './ai-events.service';
import { AIEventsController } from './ai-events.controller';

@Module({
  controllers: [AIEventsController],
  providers: [AIEventsService],
  exports: [AIEventsService],
})
export class AIEventsModule {}
