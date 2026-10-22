
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { join } from 'node:path';

import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';

const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

type UpdateProfileBody = {
  name?: string;
  bio?: string | null;
};

function imageUploadOptions(maxBytes: number) {
  return {
    storage: diskStorage({
      destination: (
        _req: Request,
        _file: Express.Multer.File,
        callback: (error: Error | null, destination: string) => void,
      ) => {
        try {
          mkdirSync(UPLOAD_DIR, { recursive: true });
          callback(null, UPLOAD_DIR);
        } catch (error) {
          callback(error as Error, UPLOAD_DIR);
        }
      },
      filename: (
        _req: Request,
        file: Express.Multer.File,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const extension = IMAGE_TYPES[file.mimetype];

        if (!extension) {
          callback(
            new BadRequestException('Unsupported image type.'),
            '',
          );
          return;
        }

        callback(null, `${randomUUID()}${extension}`);
      },
    }),
    limits: {
      fileSize: maxBytes,
      files: 1,
    },
    fileFilter: (
      _req: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!IMAGE_TYPES[file.mimetype]) {
        callback(
          new BadRequestException(
            'Please select a JPG, PNG, or WebP image.',
          ),
          false,
        );
        return;
      }

      callback(null, true);
    },
  };
}

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.profileService.getMyProfile(req.user.userId);
  }


@Get(':userId')
getPublicProfile(
  @Req() req: AuthenticatedRequest,
  @Param('userId') userId: string,
) {
  return this.profileService.getPublicProfile(
    req.user.userId,
    userId,
  );
}


  @Patch('me')
  updateMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateProfileBody,
  ) {
    return this.profileService.updateMyProfile(
      req.user.userId,
      body,
    );
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor(
      'file',
      imageUploadOptions(5 * 1024 * 1024),
    ),
  )
  uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Please select a profile picture.');
    }

    return this.profileService.updateProfileImage(
      req.user.userId,
      file,
      'avatarKey',
    );
  }

  @Post('me/cover')
  @UseInterceptors(
    FileInterceptor(
      'file',
      imageUploadOptions(10 * 1024 * 1024),
    ),
  )
  uploadCover(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Please select a cover photo.');
    }

    return this.profileService.updateProfileImage(
      req.user.userId,
      file,
      'coverKey',
    );
  }
}
