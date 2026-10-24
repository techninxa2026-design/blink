import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExchangeChatService } from './Exchange-chat.service';

type AuthenticatedRequest = {
  user: {
    userId: string;
  };
};

@Controller('Exchange/:postId/chats')
@UseGuards(JwtAuthGuard)
export class ExchangeChatController {
  constructor(
    private readonly chat: ExchangeChatService,
  ) {}

  @Get('mine')
  myThread(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    return this.chat.myThread(
      req.user.userId,
      postId,
    );
  }

  @Post()
  start(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    return this.chat.startThread(
      req.user.userId,
      postId,
    );
  }

  @Get()
  interestedPeople(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    return this.chat.ownerThreads(
      req.user.userId,
      postId,
    );
  }

  @Get(':threadId/messages')
  messages(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Param('threadId') threadId: string,
  ) {
    return this.chat.messages(
      req.user.userId,
      postId,
      threadId,
    );
  }

  @Post(':threadId/messages')
  send(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Param('threadId') threadId: string,
    @Body() body: { text?: string },
  ) {
    return this.chat.sendMessage(
      req.user.userId,
      postId,
      threadId,
      body?.text,
    );
  }
}