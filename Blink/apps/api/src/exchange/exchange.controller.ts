import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ExchangeService,
  Exchange_MEDIA_DIR,
} from './Exchange.service';

type AuthenticatedRequest = {
  user: { userId: string };
};

const allowedMimeToExtension: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const uploads: NonNullable<Parameters<typeof FilesInterceptor>[2]> = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(Exchange_MEDIA_DIR, {
        recursive: true,
      });

      callback(null, Exchange_MEDIA_DIR);
    },

    filename: (_req, file, callback) => {
      callback(
        null,
        randomUUID() +
          allowedMimeToExtension[file.mimetype],
      );
    },
  }),

  limits: {
    fileSize: 40 * 1024 * 1024,
    files: 4,
    fields: 8,
  },

  fileFilter: (_req, file, callback) => {
    const extension = file.originalname
      .toLowerCase()
      .match(/\.[^.]+$/)?.[0];

    const canonicalExtension =
      allowedMimeToExtension[file.mimetype];

    const valid =
      Boolean(canonicalExtension) &&
      (extension === canonicalExtension ||
        (file.mimetype === 'image/jpeg' &&
          extension === '.jpeg'));

    if (!valid) {
      callback(
        new BadRequestException(
          'Only JPG, PNG, WebP, MP4, WebM and MOV files are allowed.',
        ),
        false,
      );
      return;
    }

    callback(null, true);
  },
};

@Controller('Exchange')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(
    private readonly Exchange: ExchangeService,
  ) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('kind') kind?: string,
    @Query('mine') mine?: string,
    @Query('page') page?: string,
  ) {
    return this.Exchange.list(req.user.userId, {
      search,
      kind,
      mine,
      page,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.Exchange.getOne(id);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 4, uploads),
  )
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFiles()
    files: Express.Multer.File[] = [],
  ) {
    return this.Exchange.create(
      req.user.userId,
      body,
      files,
    );
  }

  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('files', 4, uploads),
  )
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles()
    files: Express.Multer.File[] = [],
  ) {
    return this.Exchange.update(
      req.user.userId,
      id,
      body,
      files,
    );
  }

  @Delete(':id')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.Exchange.remove(
      req.user.userId,
      id,
    );
  }

  @Post(':id/responses')
  reply(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { message?: string },
  ) {
    return this.Exchange.reply(
      req.user.userId,
      id,
      body?.message,
    );
  }

  @Patch(':id/responses/:responseId/acknowledge')
  acknowledge(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('responseId') responseId: string,
  ) {
    return this.Exchange.acknowledge(
      req.user.userId,
      id,
      responseId,
    );
  }
}

// Public media route for displaying attachments.
@Controller('Exchange/media')
export class ExchangeMediaController {
  constructor(
    private readonly Exchange: ExchangeService,
  ) {}

  @Get(':id')
  async show(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const media = await this.Exchange.getMedia(id);

    res.setHeader(
      'Content-Type',
      media.mimeType,
    );

    res.setHeader(
      'X-Content-Type-Options',
      'nosniff',
    );

    res.setHeader(
      'Cache-Control',
      'public, max-age=3600',
    );

    return res.sendFile(media.key, {
      root: Exchange_MEDIA_DIR,
    });
  }
}