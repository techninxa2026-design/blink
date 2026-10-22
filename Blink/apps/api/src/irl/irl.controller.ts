import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IrlService } from './irl.service';
type AuthRequest = { user: { userId: string } };
@Controller('irl')
@UseGuards(JwtAuthGuard)
export class IrlController {
  constructor(private readonly service: IrlService) {}
  @Get('invitations') invitations(@Req() req: AuthRequest) { return this.service.invitations(req.user.userId); }
  @Post('plans/:id/invitations') invite(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: { recipientId?: string }) { return this.service.invite(req.user.userId, id, body?.recipientId || ''); }
  @Post('invitations/:id/respond') respondInvitation(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: { status?: string }) { return this.service.respondInvitation(req.user.userId, id, body?.status); }
  @Get('plans/:id/messages') inboxMessages(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.inboxMessages(req.user.userId, id); }
  @Post('plans/:id/messages') sendInboxMessage(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.sendInboxMessage(req.user.userId, id, body); }
  @Get('plans') plans(@Req() req: AuthRequest) { return this.service.list(req.user.userId); }
  @Post('plans') create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create(req.user.userId, body); }
  @Delete('plans/:id') remove(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.remove(req.user.userId, id); }
  @Post('plans/:id/interest') interest(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.interest(req.user.userId, id, body); }
  @Delete('plans/:id/interest') withdraw(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.withdraw(req.user.userId, id); }
}
