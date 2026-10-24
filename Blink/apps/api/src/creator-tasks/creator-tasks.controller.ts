import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { CreatorTasksService, VIDEO_CHUNK_BYTES } from './creator-tasks.service';
import { SaveTaskDto, StartVideoDto } from './creator-tasks.dto';
import { TaskReviewService } from './task-review.service';
import { ReviewTaskAnswerDto } from './task-review.dto';

type AuthRequest = { user: AuthenticatedUser };

@Controller('creator-tasks')
@UseGuards(JwtAuthGuard)
export class CreatorTasksController {
  constructor(private readonly service: CreatorTasksService, private readonly reviews: TaskReviewService) {}

  @Get('mine') mine(@Req() req: AuthRequest) {
    return this.service.myTasks(req.user.userId);
  }
  @Get() published(@Req() req: AuthRequest, @Query('page') page?: string, @Query('q') query?: string) {
    return this.service.published(req.user.userId, page, query);
  }
  @Get('uploads/:id') uploadStatus(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.uploadStatus(req.user.userId, id);
  }
  @Post('uploads') startUpload(@Req() req: AuthRequest, @Body() input: StartVideoDto) {
    return this.service.startUpload(req.user.userId, input);
  }
  @Post('uploads/:id/chunks/:index')
  @UseInterceptors(FileInterceptor('chunk', {
    storage: memoryStorage(), limits: { fileSize: VIDEO_CHUNK_BYTES, files: 1 },
  }))
  uploadChunk(
    @Req() req: AuthRequest, @Param('id') id: string, @Param('index', ParseIntPipe) index: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.uploadChunk(req.user.userId, id, index, file?.buffer);
  }
  @Post('uploads/:id/complete') finishUpload(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.finishUpload(req.user.userId, id);
  }
  @Delete('uploads/:id') cancelUpload(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.cancelUpload(req.user.userId, id);
  }
  @Post('images')
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  }))
  uploadImage(@Req() req: AuthRequest, @UploadedFile() file?: Express.Multer.File) {
    return this.service.uploadImage(req.user.userId, file);
  }
  @Get('images/:id')
  privateImage(@Req() req: AuthRequest, @Param('id') id: string, @Res() response: Response) {
    return this.service.streamImage(id, response, req.user.userId);
  }
  @Get(':id/submissions')
  submissions(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.reviews.list(req.user.userId, id);
  }
  @Post(':id/submissions/:participationId/steps/:stepId/review')
  reviewItem(@Req() req: AuthRequest, @Param('id') id: string,
    @Param('participationId') participationId: string, @Param('stepId') stepId: string,
    @Body() dto: ReviewTaskAnswerDto) {
    return this.reviews.review(req.user.userId, id, participationId, stepId, dto.decision, dto.note);
  }
  @Get(':id') detail(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.detail(req.user.userId, id);
  }
  @Post() create(@Req() req: AuthRequest, @Body() dto: SaveTaskDto) {
    return this.service.save(req.user.userId, dto);
  }
  @Put(':id') update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: SaveTaskDto) {
    return this.service.save(req.user.userId, dto, id);
  }
  @Delete(':id') remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}

@Controller('task-media')
export class TaskMediaController {
  constructor(private readonly service: CreatorTasksService) {}

  @Get('images/:id')
  image(@Param('id') id: string, @Res() response: Response) {
    return this.service.streamImage(id, response);
  }

  // Publicly playable only for published tasks. Draft media stays private.
  @Get(':id')
  video(@Param('id') id: string, @Req() req: { headers: { range?: string } }, @Res() response: Response) {
    return this.service.streamVideo(id, response, req.headers.range);
  }
}
