
import {
  Body,
  Delete,
  Patch,
  Res,
  UploadedFile,
  UseInterceptors,
  Controller,
  Get,
  Param,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InboxService } from './inbox.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'express';

type AuthenticatedRequest = {
  user: {
    userId: string;
  };
};

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  listConversations(@Req() req: AuthenticatedRequest) {
    return this.inboxService.listConversations(req.user.userId);
  }

  @Get('friends')
  listMessageableFriends(@Req() req: AuthenticatedRequest) {
    return this.inboxService.listMessageableFriends(req.user.userId);
  }

  @Post('conversations')
  openConversation(
    @Req() req: AuthenticatedRequest,
    @Body() body: { friendId?: string },
  ) {
    return this.inboxService.openConversation(
      req.user.userId,
      body?.friendId ?? '',
    );
  }

  @Post('groups')
  createGroup(@Req() req: AuthenticatedRequest, @Body() body: { name?: unknown; friendIds?: unknown }) {
    return this.inboxService.createGroup(req.user.userId, body?.name, body?.friendIds);
  }

  @Patch('groups/:id/name')
  renameGroup(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { name?: unknown }) {
    return this.inboxService.renameGroup(req.user.userId, id, body?.name);
  }

  @Post('groups/:id/members')
  addGroupMembers(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { friendIds?: unknown }) {
    return this.inboxService.addGroupMembers(req.user.userId, id, body?.friendIds);
  }

  @Delete('groups/:id/members/:userId')
  removeGroupMember(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('userId') targetId: string) {
    return this.inboxService.removeGroupMember(req.user.userId, id, targetId);
  }

  @Post('groups/:id/leave')
  leaveGroup(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.inboxService.leaveGroup(req.user.userId, id);
  }

  @Get('conversations/:id/search')
  search(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Query('q') q: string) {
    return this.inboxService.searchMessages(req.user.userId, id, q);
  }

  @Patch('conversations/:id/mute')
  mute(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { muted?: unknown }) {
    return this.inboxService.setMute(req.user.userId, id, body?.muted);
  }

  @Delete('conversations/:id')
  clearConversation(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.inboxService.clearConversation(req.user.userId, id);
  }

  @Patch('blocks/:userId')
  block(@Req() req: AuthenticatedRequest, @Param('userId') id: string, @Body() body: { blocked?: unknown }) {
    return this.inboxService.setBlock(req.user.userId, id, body?.blocked);
  }

  @Get('conversations/:id')
  getConversation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('around') around?: string,
  ) {
    return this.inboxService.getConversation(req.user.userId, id, around);
  }
  @Post('conversations/:id/read')
  markRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.inboxService.markRead(req.user.userId, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { body?: unknown; replyToId?: unknown },
  ) {
    return this.inboxService.sendMessage(req.user.userId, id, body?.body, body?.replyToId);
  }

  @Patch('conversations/:id/pin')
  pinMessage(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { messageId?: unknown }) {
    return this.inboxService.pinMessage(req.user.userId, id, body?.messageId);
  }

  @Post('messages/:messageId/forward')
  forwardMessage(@Req() req: AuthenticatedRequest, @Param('messageId') id: string, @Body() body: { friendIds?: unknown }) {
    return this.inboxService.forwardMessage(req.user.userId, id, body?.friendIds);
  }

  @Patch('messages/:messageId')
  editMessage(@Req() req: AuthenticatedRequest, @Param('messageId') id: string, @Body() body: { body?: unknown }) {
    return this.inboxService.editMessage(req.user.userId, id, body?.body);
  }

  @Delete('messages/:messageId')
  hideMessage(@Req() req: AuthenticatedRequest, @Param('messageId') id: string) {
    return this.inboxService.hideMessage(req.user.userId, id);
  }

  @Post('messages/:messageId/unsend')
  unsendMessage(@Req() req: AuthenticatedRequest, @Param('messageId') id: string) {
    return this.inboxService.unsendMessage(req.user.userId, id);
  }

  @Post('messages/:messageId/reaction')
  react(@Req() req: AuthenticatedRequest, @Param('messageId') id: string, @Body() body: { emoji?: unknown }) {
    return this.inboxService.reactToMessage(req.user.userId, id, body?.emoji);
  }

  @Post('conversations/:id/media')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        const isPrivate = String(req.body?.isPrivate) === 'true';
        const dir = join(process.cwd(), 'inbox-storage', isPrivate ? 'inbox-private' : 'inbox-media');
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'].includes(file.mimetype)),
  }))
  sendMedia(@Req() req: AuthenticatedRequest, @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File, @Body() body: { isPrivate?: string }) {
    return this.inboxService.sendMedia(req.user.userId, id, file, body?.isPrivate === 'true');
  }

  @Get('media/:messageId')
  async media(@Req() req: AuthenticatedRequest, @Param('messageId') messageId: string, @Res() res: Response) {
    const result = await this.inboxService.getMedia(req.user.userId, messageId, false);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', result.mime);
    result.stream.pipe(res);
  }

  @Post('media/:messageId/open')
  async openPrivateMedia(@Req() req: AuthenticatedRequest, @Param('messageId') messageId: string, @Res() res: Response) {
    const result = await this.inboxService.getMedia(req.user.userId, messageId, true);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', result.mime);
    result.stream.pipe(res);
  }

}
