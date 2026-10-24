import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post,
  Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { REEL_COVER_DIR, REEL_VIDEO_DIR, REEL_MAX_BYTES, ReelsService } from './reels.service';

type AuthReq = Request & { user: AuthenticatedUser };
type ReelFiles = { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] };
const VIDEO_MIMES: Record<string, string> = {
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
};

@Controller('reels')
@UseGuards(JwtAuthGuard)
export class ReelsController {
  constructor(private readonly reels: ReelsService) {}

  @Get()
  feed(@Req() req: AuthReq, @Query('skip') skip?: string) {
    return this.reels.feed(req.user.userId, Number(skip || 0));
  }

  @Get('mine')
  mine(@Req() req: AuthReq) {
    return this.reels.mine(req.user.userId);
  }

  @Get('user/:userId')
  byCreator(@Req() req: AuthReq, @Param('userId') userId: string) {
    return this.reels.mine(req.user.userId, userId);
  }

  @Post('upload')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 },
  ], {
    storage: diskStorage({
      destination: (_req, file, done) => {
        const dir = file.fieldname === 'video' ? REEL_VIDEO_DIR : REEL_COVER_DIR;
        try { mkdirSync(dir, { recursive: true }); done(null, dir); }
        catch (error) { done(error as Error, dir); }
      },
      filename: (_req, file, done) => {
        if (file.fieldname === 'video' && VIDEO_MIMES[file.mimetype]) {
          done(null, randomUUID() + VIDEO_MIMES[file.mimetype]);
        } else if (file.fieldname === 'thumbnail' && file.mimetype === 'image/jpeg') {
          done(null, randomUUID() + '.jpg');
        } else {
          done(new BadRequestException('Invalid reel video or thumbnail format.'), '');
        }
      },
    }),
    limits: { files: 2, fileSize: REEL_MAX_BYTES },
    fileFilter: (_req, file, done) => {
      const accepted = (file.fieldname === 'video' && Boolean(VIDEO_MIMES[file.mimetype]))
        || (file.fieldname === 'thumbnail' && file.mimetype === 'image/jpeg');
      if (!accepted) done(new BadRequestException('Upload MP4/MOV/WebM video and JPEG cover.'), false);
      else done(null, true);
    },
  }))
  upload(@Req() req: AuthReq, @UploadedFiles() files: ReelFiles,
    @Body('caption') caption: unknown, @Body('duration') duration: unknown,
    @Body('coverTime') coverTime: unknown) {
    return this.reels.create(req.user.userId, files || {}, caption, duration, coverTime);
  }

  @Get(':id')
  detail(@Req() req: AuthReq, @Param('id') id: string) {
    return this.reels.detail(req.user.userId, id);
  }

  @Post(':id/view')
  recordView(@Req() req: AuthReq, @Param('id') id: string) {
    return this.reels.view(req.user.userId, id);
  }

  @Post(':id/react')
  react(@Req() req: AuthReq, @Param('id') id: string, @Body('emoji') emoji: unknown) {
    return this.reels.react(req.user.userId, id, emoji);
  }

  @Get(':id/comments')
  comments(@Param('id') id: string) {
    return this.reels.comments(id);
  }

  @Post(':id/comments')
  comment(@Req() req: AuthReq, @Param('id') id: string,
    @Body('body') body: unknown, @Body('parentId') parentId?: unknown) {
    return this.reels.comment(req.user.userId, id, body, parentId);
  }

  @Delete('comments/:commentId')
  deleteComment(@Req() req: AuthReq, @Param('commentId') id: string) {
    return this.reels.deleteComment(req.user.userId, id);
  }

  @Post(':id/share')
  share(@Req() req: AuthReq, @Param('id') id: string,
    @Body('friendIds') friends: unknown) {
    return this.reels.share(req.user.userId, id, friends,
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined);
  }

  @Delete(':id')
  delete(@Req() req: AuthReq, @Param('id') id: string) {
    return this.reels.remove(req.user.userId, id);
  }
}

/** Only publicly published Reels can be streamed by id; no filesystem path input. */
@Controller('reels/media')
export class ReelsMediaController {
  constructor(private readonly reels: ReelsService) {}

  @Get(':id/thumbnail')
  cover(@Param('id') id: string, @Res() res: Response) {
    return this.reels.stream(id, 'cover', res);
  }

  @Get(':id/stream')
  stream(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    return this.reels.stream(id, 'video', res, req.headers.range);
  }
}
