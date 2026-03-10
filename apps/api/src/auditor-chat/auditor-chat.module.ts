import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditorChatController } from './auditor-chat.controller';
import { AuditorChatService } from './auditor-chat.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuditorChatController],
  providers: [AuditorChatService],
  exports: [AuditorChatService],
})
export class AuditorChatModule {}
