import {
  Body, Controller, Delete, Get, Param, Post, Put, Req, Res,
  UploadedFile, UseGuards, UseInterceptors, ParseIntPipe, Query,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { TaskParticipationsService, PARTICIPATION_CHUNK_SIZE } from './task-participations.service';
import { TaskReviewService } from './task-review.service';
import { SaveParticipationDto, SaveParticipationStepDto, StartParticipationVideoDto, UpdateChecklistDto } from './task-participations.dto';

type AuthRequest = { user: AuthenticatedUser };

@Controller('task-participations')
@UseGuards(JwtAuthGuard)
export class TaskParticipationsController {
  constructor(private readonly service: TaskParticipationsService, private readonly jwt: JwtService,
    private readonly reviews: TaskReviewService) {}

  @Post('images')
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  }))
  uploadImage(@Req() req: AuthRequest, @UploadedFile() file?: Express.Multer.File) {
    return this.service.uploadImage(req.user.userId, file);
  }

  @Get('images/:id')
  image(@Req() req: AuthRequest, @Param('id') id: string, @Res() response: Response) {
    return this.service.streamImage(req.user.userId, id, response);
  }

  @Delete('images/:id')
  deleteUnattached(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.deleteUnattached(req.user.userId, id);
  }


  @Put(':taskId/checklist')
  updateChecklist(@Req() req: AuthRequest, @Param('taskId') taskId: string,
    @Body() input: UpdateChecklistDto) {
    return this.service.saveChecklist(req.user.userId, taskId, input.checkedItemIds);
  }

  @Post(':taskId/submit')
  submit(@Req() req: AuthRequest, @Param('taskId') taskId: string) {
    return this.reviews.submit(req.user.userId, taskId);
  }

  @Put(':taskId/steps/:itemId')
  saveStep(@Req() req: AuthRequest, @Param('taskId') taskId: string,
    @Param('itemId') itemId: string, @Body() input: SaveParticipationStepDto) {
    return this.service.saveStep(req.user.userId, taskId, itemId, input);
  }

  @Post('videos')
  startVideo(@Req() req: AuthRequest, @Body() input: StartParticipationVideoDto) {
    return this.service.startVideo(req.user.userId, input);
  }

  @Get('videos/:id')
  videoStatus(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.videoStatus(req.user.userId, id);
  }

  @Post('videos/:id/chunks/:index')
  @UseInterceptors(FileInterceptor('chunk', {
    storage: memoryStorage(), limits: { fileSize: PARTICIPATION_CHUNK_SIZE, files: 1 },
  }))
  videoChunk(@Req() req: AuthRequest, @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number, @UploadedFile() file?: Express.Multer.File) {
    return this.service.videoChunk(req.user.userId, id, index, file?.buffer);
  }

  @Post('videos/:id/complete')
  completeVideo(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.completeVideo(req.user.userId, id);
  }

  @Delete('videos/:id')
  deleteVideo(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.deleteUnattachedVideo(req.user.userId, id);
  }

  @Get('videos/:id/playback')
  async playback(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.service.assertVideoAccess(req.user.userId, id);
    const token = await this.jwt.signAsync({
      sub: req.user.userId, videoId: id, scope: 'participation-video',
    }, { expiresIn: '15m' });
    return { url: '/task-participations/play/' + encodeURIComponent(id) +
      '?ticket=' + encodeURIComponent(token) };
  }

  @Get(':taskId/me')
  mine(@Req() req: AuthRequest, @Param('taskId') taskId: string) {
    return this.service.mine(req.user.userId, taskId);
  }

  @Put(':taskId/me')
  save(@Req() req: AuthRequest, @Param('taskId') taskId: string, @Body() dto: SaveParticipationDto) {
    return this.service.save(req.user.userId, taskId, dto);
  }
}

@Controller('task-participations/play')
export class ParticipationPlaybackController {
  constructor(private readonly service: TaskParticipationsService,
    private readonly jwt: JwtService) {}

  @Get(':id')
  async stream(@Param('id') id: string, @Query('ticket') ticket: string | undefined,
    @Req() req: { headers: { range?: string } }, @Res() response: Response) {
    if (!ticket) throw new UnauthorizedException('Video access is required.');
    let payload: { sub: string; videoId: string; scope: string };
    try {
      payload = await this.jwt.verifyAsync(ticket);
    } catch {
      throw new UnauthorizedException('Video access has expired.');
    }
    if (payload.scope !== 'participation-video' || payload.videoId !== id || !payload.sub) {
      throw new ForbiddenException('Invalid video access.');
    }
    await this.service.assertVideoAccess(payload.sub, id);
    return this.service.streamVideo(id, response, req.headers.range);
  }
}
