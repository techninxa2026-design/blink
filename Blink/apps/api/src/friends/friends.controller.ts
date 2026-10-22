
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}
  @Get('search')
searchUsers(
  @Req() req: AuthenticatedRequest,
  @Query('q') query?: string,
) {
  return this.friendsService.searchUsers(req.user.userId, query);
}

  @Post('requests')
  sendRequest(
    @Req() req: AuthenticatedRequest,
    @Body() body: { receiverId?: string },
  ) {
    return this.friendsService.sendRequest(
      req.user.userId,
      body?.receiverId,
    );
  }

  @Get('requests/incoming')
  getIncoming(@Req() req: AuthenticatedRequest) {
    return this.friendsService.getIncoming(req.user.userId);
  }

  @Get('requests/outgoing')
  getOutgoing(@Req() req: AuthenticatedRequest) {
    return this.friendsService.getOutgoing(req.user.userId);
  }

  @Post('requests/:id/accept')
  accept(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.friendsService.acceptRequest(req.user.userId, id);
  }

  @Post('requests/:id/decline')
  decline(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.friendsService.declineRequest(req.user.userId, id);
  }

  @Get()
  getFriends(@Req() req: AuthenticatedRequest) {
    return this.friendsService.getFriends(req.user.userId);
  }

@Delete(':userId')
unfriend(
  @Req() req: AuthenticatedRequest,
  @Param('userId') userId: string,
) {
  return this.friendsService.unfriend(req.user.userId, userId);
}
}