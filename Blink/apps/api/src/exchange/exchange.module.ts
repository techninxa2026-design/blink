import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import {
  ExchangeController,
  ExchangeMediaController,
} from './Exchange.controller';

import { ExchangeService } from './Exchange.service';

import { ExchangeChatController } from './Exchange-chat.controller';
import { ExchangeChatService } from './Exchange-chat.service';

import { ExchangeOfferController } from './Exchange-offer.controller';
import { ExchangeOfferService } from './Exchange-offer.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    ExchangeController,
    ExchangeMediaController,
    ExchangeChatController,
    ExchangeOfferController,
  ],
  providers: [
    ExchangeService,
    ExchangeChatService,
    ExchangeOfferService,
  ],
})
export class ExchangeModule {}