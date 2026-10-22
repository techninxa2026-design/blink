
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
