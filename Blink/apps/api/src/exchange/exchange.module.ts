import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import {
  ExchangeController,
  ExchangeMediaController,
} from './exchange.controller';

import { ExchangeService } from './exchange.service';

import { ExchangeChatController } from './exchange-chat.controller';
import { ExchangeChatService } from './exchange-chat.service';

import { ExchangeOfferController } from './exchange-offer.controller';
import { ExchangeOfferService } from './exchange-offer.service';

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