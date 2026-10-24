import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InboxModule } from '../inbox/inbox.module';
import { ReelsController, ReelsMediaController } from './reels.controller';
import { ReelsService } from './reels.service';

@Module({
  imports: [PrismaModule, InboxModule],
  controllers: [ReelsController, ReelsMediaController],
  providers: [ReelsService],
})
export class ReelsModule {}
