import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CreatorTasksController, TaskMediaController } from './creator-tasks.controller';
import { CreatorTasksService } from './creator-tasks.service';
import { TaskParticipationsController, ParticipationPlaybackController } from './task-participations.controller';
import { TaskParticipationsService } from './task-participations.service';
import { TaskReviewService } from './task-review.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CreatorTasksController, TaskMediaController, TaskParticipationsController, ParticipationPlaybackController],
  providers: [CreatorTasksService, TaskParticipationsService, TaskReviewService],
})
export class CreatorTasksModule {}
