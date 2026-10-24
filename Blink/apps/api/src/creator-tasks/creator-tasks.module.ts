import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CreatorTasksController, TaskMediaController } from './creator-tasks.controller';
import { CreatorTasksService } from './creator-tasks.service';
import { TaskParticipationsController } from './task-participations.controller';
import { TaskParticipationsService } from './task-participations.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CreatorTasksController, TaskMediaController, TaskParticipationsController],
  providers: [CreatorTasksService, TaskParticipationsService],
})
export class CreatorTasksModule {}
