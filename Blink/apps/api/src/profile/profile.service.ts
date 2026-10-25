
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';

const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');

type UpdateProfileBody = {
  name?: string;
  bio?: string | null;
  college?: string | null;
  highSchool?: string | null;
  occupation?: string | null;
  workplace?: string | null;
};

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // Get the signed-in user's profile.
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        avatarKey: true,
        bio: true,
        college: true,
        highSchool: true,
        occupation: true,
        workplace: true,
        coverKey: true,
        createdAt: true,
        _count: {
          select: {
            sentRequests: {
              where: { status: 'ACCEPTED' },
            },
            receivedRequests: {
              where: { status: 'ACCEPTED' },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Profile not found.');
    }

    const connections = await this.prisma.friendship.count({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      avatarKey: user.avatarKey,
      bio: user.bio,
      coverKey: user.coverKey,
      createdAt: user.createdAt,
      followersCount: connections,
      followingCount: connections,
      connectionsCount: connections,
    };
  }

  // Update display name and bio.
  async updateMyProfile(
    userId: string,
    body: UpdateProfileBody,
  ) {
    const data: UpdateProfileBody = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        throw new BadRequestException('Name must be text.');
      }

      const name = body.name.trim();

      if (name.length < 2 || name.length > 80) {
        throw new BadRequestException(
          'Name must be between 2 and 80 characters.',
        );
      }

      data.name = name;
    }

    if (body.bio !== undefined) {
      if (
        body.bio !== null &&
        typeof body.bio !== 'string'
      ) {
        throw new BadRequestException('Bio must be text.');
      }

      const bio =
        typeof body.bio === 'string'
          ? body.bio.trim()
          : '';

      if (bio.length > 300) {
        throw new BadRequestException(
          'Bio cannot exceed 300 characters.',
        );
      }

      data.bio = bio || null;
    }

    // Optional education and work details; trim and validate on the server.
    for (const field of ['college', 'highSchool', 'occupation', 'workplace'] as const) {
      const value = body[field];
      if (value === undefined) continue;
      if (value !== null && typeof value !== 'string') {
        throw new BadRequestException(`${field} must be text.`);
      }
      const cleaned = typeof value === 'string' ? value.trim() : '';
      if (cleaned.length > 160) {
        throw new BadRequestException(`${field} cannot exceed 160 characters.`);
      }
      data[field] = cleaned || null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'No profile changes provided.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundException('Profile not found.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return this.getMyProfile(userId);
  }

  // Upload a profile picture or cover photo.
  async updateProfileImage(
    userId: string,
    file: Express.Multer.File,
    field: 'avatarKey' | 'coverKey',
  ) {
    let saved = false;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          avatarKey: true,
          coverKey: true,
        },
      });

      if (!user) {
        throw new NotFoundException('Profile not found.');
      }

      const previousKey = user[field];

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          [field]: file.filename,
        },
      });

      saved = true;

      // Delete the previous image if it was stored locally.
      // Never delete arbitrary paths or remote URLs.
      if (
        previousKey &&
        previousKey !== file.filename &&
        /^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(
          previousKey,
        ) &&
        basename(previousKey) === previousKey
      ) {
        try {
          await unlink(join(UPLOAD_DIR, previousKey));
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code !==
            'ENOENT'
          ) {
            console.error(
              'Could not remove old profile image:',
              error,
            );
          }
        }
      }

      return this.getMyProfile(userId);
    } catch (error) {
      // Remove the newly uploaded file only if it was
      // not successfully saved in the database.
      if (!saved) {
        try {
          await unlink(file.path);
        } catch (cleanupError) {
          console.error(
            'Could not clean up failed profile upload:',
            cleanupError,
          );
        }
      }

      throw error;
    }
  }


async getPublicProfile(viewerId: string, userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      bio: true,
      avatarKey: true,
      coverKey: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundException('User not found.');
  }

  const [userAId, userBId] = [viewerId, userId].sort();

  const [connectionsCount, friendship, outgoing, incoming, moments] =
    await Promise.all([
      this.prisma.friendship.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      }),
      this.prisma.friendship.findUnique({
        where: {
          userAId_userBId: { userAId, userBId },
        },
      }),
      this.prisma.friendRequest.findFirst({
        where: {
          senderId: viewerId,
          receiverId: userId,
          status: 'PENDING',
        },
        select: { id: true },
      }),
      this.prisma.friendRequest.findFirst({
        where: {
          senderId: userId,
          receiverId: viewerId,
          status: 'PENDING',
        },
        select: { id: true },
      }),
      this.prisma.moment.findMany({
        where: {
          senderId: userId,
          type: 'PUBLIC',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        select: {
          id: true,
          mediaKey: true,
          caption: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
    ]);

  return {
    ...user,
    connectionsCount,
    relationship:
      viewerId === userId
        ? 'SELF'
        : friendship
          ? 'FRIENDS'
          : outgoing
            ? 'OUTGOING_PENDING'
            : incoming
              ? 'INCOMING_PENDING'
              : 'NONE',
    incomingRequestId: incoming?.id ?? null,
    moments: moments.map((moment) => ({
      id: moment.id,
      mediaUrl: `/uploads/${encodeURIComponent(moment.mediaKey)}`,
      mediaType: /\.(mp4|webm|mov)$/i.test(moment.mediaKey)
        ? 'video'
        : 'photo',
      caption: moment.caption,
      createdAt: moment.createdAt,
    })),
  };
}


}
