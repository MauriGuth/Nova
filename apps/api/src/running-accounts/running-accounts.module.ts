import { Module } from '@nestjs/common';
import { ArcaModule } from '../arca/arca.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RunningAccountsController } from './running-accounts.controller';
import { RunningAccountsService } from './running-accounts.service';

@Module({
  imports: [PrismaModule, ArcaModule],
  controllers: [RunningAccountsController],
  providers: [RunningAccountsService],
})
export class RunningAccountsModule {}
