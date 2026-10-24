import {
  Body, Controller, Delete, Get, Param, Post, Put, Req, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { TaskParticipationsService } from './task-participations.service';
import { SaveParticipationDto } from './task-participations.dto';

type AuthRequest = { user: AuthenticatedUser };

@Controller('task-participations')
@UseGuards(JwtAuthGuard)
export class TaskParticipationsController {
  constructor(private readonly service: TaskParticipationsService) {}

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

  @Get(':taskId/me')
  mine(@Req() req: AuthRequest, @Param('taskId') taskId: string) {
    return this.service.mine(req.user.userId, taskId);
  }

  @Put(':taskId/me')
  save(@Req() req: AuthRequest, @Param('taskId') taskId: string, @Body() dto: SaveParticipationDto) {
    return this.service.save(req.user.userId, taskId, dto);
  }
}
