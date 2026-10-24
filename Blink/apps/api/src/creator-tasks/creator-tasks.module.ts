import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CreatorTasksController, TaskMediaController } from './creator-tasks.controller';
import { CreatorTasksService } from './creator-tasks.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CreatorTasksController, TaskMediaController],
  providers: [CreatorTasksService],
})
export class CreatorTasksModule {}
