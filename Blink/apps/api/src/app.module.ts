import { ExchangeModule } from './Exchange/Exchange.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MomentsModule } from './moments/moments.module';
import { ProfileModule } from './profile/profile.module';
import { FriendsModule } from './friends/friends.module';
import { InboxModule } from './inbox/inbox.module';
import { CheckinsModule } from './checkins/checkins.module';
import { IrlModule } from './irl/irl.module';
import { SecretsModule } from './secrets/secrets.module';
import { HeartsModule } from './hearts/hearts.module';
import { BusinessMatchModule } from './business-match/business-match.module';
import { CreatorTasksModule } from './creator-tasks/creator-tasks.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MomentsModule,
    ProfileModule,
    FriendsModule,
    InboxModule,
    CheckinsModule,
    IrlModule,
    ExchangeModule,
    SecretsModule,
    HeartsModule,
    BusinessMatchModule,
    CreatorTasksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
