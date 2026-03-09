import { Module } from '@nestjs/common';
import { WasteRecordsController } from './waste-records.controller';
import { WasteRecordsService } from './waste-records.service';

@Module({
  controllers: [WasteRecordsController],
  providers: [WasteRecordsService],
  exports: [WasteRecordsService],
})
export class WasteRecordsModule {}
