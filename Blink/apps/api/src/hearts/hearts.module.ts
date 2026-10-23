
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { HeartsController } from './hearts.controller';
import { HeartsService } from './hearts.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [HeartsController],
  providers: [HeartsService],
})
export class HeartsModule {}
