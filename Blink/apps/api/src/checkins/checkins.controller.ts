import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, AuthenticatedUser } from '../auth/jwt-auth.guard';
import { CheckinsService } from './checkins.service';

type AuthedRequest = { user: AuthenticatedUser };

@Controller('checkins')
@UseGuards(JwtAuthGuard)
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Get()
  feed(@Req() req: AuthedRequest) {
    return this.checkins.feed(req.user.userId);
  }

  @Get('mine')
  mine(@Req() req: AuthedRequest) {
    return this.checkins.mine(req.user.userId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.checkins.create(req.user.userId, body);
  }

  @Patch(':id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.checkins.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.checkins.remove(req.user.userId, id);
  }
}
