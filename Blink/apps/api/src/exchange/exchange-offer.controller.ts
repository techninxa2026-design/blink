
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExchangeOfferService } from './exchange-offer.service';

type AuthRequest = {
  user: {
    userId: string;
  };
};

type PriceOfferBody = {
  amount?: string;
  currency?: string;
};

@Controller('Exchange/:postId/chats/:threadId/offer')
@UseGuards(JwtAuthGuard)
export class ExchangeOfferController {
  constructor(
    private readonly offers: ExchangeOfferService,
  ) {}

  @Get()
  get(
    @Req() req: AuthRequest,
    @Param('postId') postId: string,
    @Param('threadId') threadId: string,
  ) {
    return this.offers.getOffer(
      req.user.userId,
      postId,
      threadId,
    );
  }

  @Post()
  create(
    @Req() req: AuthRequest,
    @Param('postId') postId: string,
    @Param('threadId') threadId: string,
    @Body() body: PriceOfferBody,
  ) {
    return this.offers.createOffer(
      req.user.userId,
      postId,
      threadId,
      body,
    );
  }

  @Patch()
  edit(
    @Req() req: AuthRequest,
    @Param('postId') postId: string,
    @Param('threadId') threadId: string,
    @Body() body: PriceOfferBody,
  ) {
    return this.offers.editOffer(
      req.user.userId,
      postId,
      threadId,
      body,
    );
  }

  @Post('accept')
  accept(
    @Req() req: AuthRequest,
    @Param('postId') postId: string,
    @Param('threadId') threadId: string,
  ) {
    return this.offers.acceptOffer(
      req.user.userId,
      postId,
      threadId,
    );
  }

  @Post('decline')
  decline(
    @Req() req: AuthRequest,
    @Param('postId') postId: string,
    @Param('threadId') threadId: string,
  ) {
    return this.offers.declineOffer(
      req.user.userId,
      postId,
      threadId,
    );
  }
}
