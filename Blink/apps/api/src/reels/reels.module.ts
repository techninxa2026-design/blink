import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { InboxModule } from '../inbox/inbox.module';
import { ReelsController, ReelsMediaController } from './reels.controller';
import { ReelsService } from './reels.service';

@Module({
  imports: [
    PrismaModule,
    InboxModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ReelsController, ReelsMediaController],
  providers: [ReelsService],
})
export class ReelsModule {}
