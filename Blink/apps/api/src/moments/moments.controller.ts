import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { JwtAuthGuard, AuthenticatedUser } from '../auth/jwt-auth.guard';
import { MomentsService } from './moments.service';

const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('moments')
@UseGuards(JwtAuthGuard)
export class MomentsController {
  constructor(private readonly momentsService: MomentsService) {}
  
@Post(':id/react')
react(
  @Req() req: AuthenticatedRequest,
  @Param('id') id: string,
  @Body('emoji') emoji: unknown,
) {
  return this.momentsService.react(
    req.user.userId,
    id,
    emoji,
  );
}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          try {
            mkdirSync(UPLOAD_DIR, { recursive: true });
            callback(null, UPLOAD_DIR);
          } catch (error) {
            callback(error as Error, UPLOAD_DIR);
          }
        },
        filename: (_req, file, callback) => {
          const extension = ALLOWED_TYPES[file.mimetype];
          if (!extension) {
            callback(new BadRequestException('Unsupported media type.'), '');
            return;
          }
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1,
      },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_TYPES[file.mimetype]) {
          callback(
            new BadRequestException(
              'Use a JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV file.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('caption') caption?: string,
    @Body('musicTrackId') musicTrackId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Please select a photo or video.');
    }

    if (caption !== undefined && typeof caption !== 'string') {
      throw new BadRequestException('Caption must be text.');
    }

    if (caption && caption.length > 500) {
      throw new BadRequestException('Caption cannot exceed 500 characters.');
    }

    return this.momentsService.create(req.user.userId, file, caption, musicTrackId);
  }

  @Get()
  findFeed(
    @Req() req: AuthenticatedRequest,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const offset = skip === undefined ? 0 : Number(skip);
    const size = take === undefined ? 100 : Number(take);
    return this.momentsService.findFeed(req.user.userId, offset, size);
  }

  @Get('mine')
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.momentsService.findMine(
      req.user.userId,
      skip === undefined ? undefined : Number(skip),
      take === undefined ? undefined : Number(take),
    );
  }

    @Post(':id/view')
  recordView(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.momentsService.recordView(req.user.userId, id);
  }

@Get(':id/views')
getViews(
  @Req() req: AuthenticatedRequest,
  @Param('id') id: string,
) {
  return this.momentsService.getViews(req.user.userId, id);
}




  @Get(':id/activity')
  activity(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.momentsService.activity(req.user.userId, id);
  }

 
@Post(':id/comments')
comment(
  @Req() req: AuthenticatedRequest,
  @Param('id') id: string,
  @Body('body') body: unknown,
  @Body('parentId') parentId?: unknown,
) {
  return this.momentsService.comment(
    req.user.userId,
    id,
    body,
    parentId,
  );
}


  @Post(':id/bp')
  giftPoints(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('amount') amount: unknown,
  ) {
    return this.momentsService.giftPoints(req.user.userId, id, amount);
  }

  @Delete('comments/:commentId')
  deleteComment(
    @Req() req: AuthenticatedRequest,
    @Param('commentId') id: string,
  ) {
    return this.momentsService.deleteComment(req.user.userId, id);
  }

  @Delete(':id')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.momentsService.remove(req.user.userId, id);
  }
}