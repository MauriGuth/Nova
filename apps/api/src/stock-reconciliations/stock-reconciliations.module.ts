import { Module } from '@nestjs/common';
import { StockReconciliationsController } from './stock-reconciliations.controller';
import { StockReconciliationsService } from './stock-reconciliations.service';

@Module({
  controllers: [StockReconciliationsController],
  providers: [StockReconciliationsService],
  exports: [StockReconciliationsService],
})
export class StockReconciliationsModule {}
