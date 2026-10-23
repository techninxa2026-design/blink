import { CreateBusinessMeetingDto } from './business-meeting.dto';
import { SendBusinessChatDto } from './business-chat.dto';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { CreateBusinessRequestDto, RespondBusinessRequestDto } from './business-connection.dto';
import { BusinessMatchService } from './business-match.service';
import { SaveBusinessProfileDto, SetBusinessActivationDto, DiscoverBusinessProfilesDto } from './business-match.dto';

type AuthRequest = { user: AuthenticatedUser };

@Controller('business-match')
@UseGuards(JwtAuthGuard)
export class BusinessMatchController {
  constructor(private readonly service: BusinessMatchService) {}

  @Get('me') mine(@Req() req: AuthRequest) { return this.service.mine(req.user.userId); }

  @Put('me') save(@Req() req: AuthRequest, @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: SaveBusinessProfileDto) {
    return this.service.save(req.user.userId, dto);
  }

  @Patch('me/activation') activate(@Req() req: AuthRequest, @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) body: SetBusinessActivationDto) {
    return this.service.activate(req.user.userId, body.active);
  }

  @Get('discover') discover(@Req() req: AuthRequest, @Query(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) filters: DiscoverBusinessProfilesDto) {
    return this.service.discover(req.user.userId, filters.q ?? '', filters.type, Number(filters.page ?? '1'));
  }

  @Get('profiles/:id') profile(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.publicProfile(req.user.userId, id);
  }
  @Post('requests') send(@Req() req: AuthRequest, @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) body: CreateBusinessRequestDto) {
    return this.service.sendRequest(req.user.userId, body.profileId);
  }
  @Get('requests') requests(@Req() req: AuthRequest) { return this.service.requests(req.user.userId); }
  @Get('connections') connections(@Req() req: AuthRequest) { return this.service.connections(req.user.userId); }
  @Patch('requests/:id') respond(@Req() req: AuthRequest, @Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) body: RespondBusinessRequestDto) {
    return this.service.respond(req.user.userId, id, body.accept);
  }
  @Delete('requests/:id') cancel(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.cancel(req.user.userId, id); }

  @Get('meetings') meetings(@Req() req: AuthRequest) { return this.service.meetings(req.user.userId); }
  @Post('meetings') createMeeting(@Req() req: AuthRequest,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CreateBusinessMeetingDto) {
    return this.service.createMeeting(req.user.userId, dto);
  }
  @Patch('meetings/:id/accept') acceptMeeting(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.answerMeeting(req.user.userId, id, true); }
  @Patch('meetings/:id/decline') declineMeeting(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.answerMeeting(req.user.userId, id, false); }
  @Patch('meetings/:id/cancel') cancelMeeting(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.cancelMeeting(req.user.userId, id); }

  @Get('chats/:connectionId/messages')
  chatMessages(@Req() req: AuthRequest, @Param('connectionId') connectionId: string, @Query('before') before?: string) {
    return this.service.chatMessages(req.user.userId, connectionId, before);
  }

  @Post('chats/:connectionId/messages')
  sendChatMessage(@Req() req: AuthRequest, @Param('connectionId') connectionId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: SendBusinessChatDto) {
    return this.service.sendChatMessage(req.user.userId, connectionId, dto.text);
  }

}
