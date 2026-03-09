import { Module } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { BatchPublicController } from './batch-public.controller';

@Module({
  controllers: [ProductionController, BatchPublicController],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}
