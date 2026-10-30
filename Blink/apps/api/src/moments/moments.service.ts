import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { MomentType } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');
const MUSIC_IDS = new Set(['sunny-pop', 'dream-cloud', 'neon-night', 'golden-hour', 'little-steps', 'soft-waves']);

@Injectable()
export class MomentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    file: Express.Multer.File,
    caption?: string,
    musicTrackId?: string,
  ) {
    if (musicTrackId && !MUSIC_IDS.has(musicTrackId)) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException('Unknown Moment soundtrack.');
    }
    const moment = await this.prisma.moment.create({
      data: {
        senderId: userId,
        type: MomentType.PUBLIC,
        mediaKey: file.filename,
        musicTrackId: musicTrackId || null,
        caption: caption?.trim() || null,
        expiresAt: null, // Public Moments are retained until deleted.
      },
    });

    return this.formatMoment(moment);
  }

  // Show every published public Moment from other authors.
  async findFeed(userId: string, skip = 0, take = 100) {
    this.validatePage(skip, take);
    const moments = await this.prisma.moment.findMany({
      where: {
        type: MomentType.PUBLIC,
        recipientId: null,
        senderId: { not: userId },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip, take,
      include: {
        sender: { select: { id: true, name: true, avatarKey: true } },
      },
    });
    return moments.map(moment => ({
      ...this.formatMoment(moment),
      sender: moment.sender,
    }));
  }

  private validatePage(skip: number, take: number) {
    if (!Number.isSafeInteger(skip) || skip < 0 ||
        !Number.isSafeInteger(take) || take < 1 || take > 100) {
      throw new BadRequestException('Invalid Moments pagination parameters.');
    }
  }

async react(
  userId: string,
  momentId: string,
  emoji: unknown,
) {
  const allowed = [
    '❤️', '🧡', '😂', '😮', '🔥', '👏',
  ];

  if (
    typeof emoji !== 'string' ||
    !allowed.includes(emoji)
  ) {
    throw new BadRequestException(
      'Invalid Moment reaction.',
    );
  }

  await this.activePublicMoment(momentId);

  const existing =
    await this.prisma.momentReaction.findUnique({
      where: {
        momentId_userId: {
          momentId,
          userId,
        },
      },
    });

  // Clicking the same reaction again removes it.
  if (existing?.emoji === emoji) {
    await this.prisma.momentReaction.deleteMany({
      where: {
        momentId,
        userId,
        emoji,
      },
    });

    return {
      ok: true,
      myReaction: null,
    };
  }

  // First reaction or changing to a different emoji.
  await this.prisma.momentReaction.upsert({
    where: {
      momentId_userId: {
        momentId,
        userId,
      },
    },
    create: {
      momentId,
      userId,
      emoji,
    },
    update: {
      emoji,
    },
  });

  return {
    ok: true,
    myReaction: emoji,
  };
}

  // Optional pagination for mobile, retaining the existing web API response.
  async findMine(userId: string, skip?: number, take?: number) {
    const paged = skip !== undefined || take !== undefined;
    if (paged) this.validatePage(skip ?? 0, take ?? 40);
    const moments = await this.prisma.moment.findMany({
      where: { senderId: userId, type: MomentType.PUBLIC, recipientId: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(paged ? { skip: skip ?? 0, take: take ?? 40 } : {}),
    });
    return moments.map(moment => this.formatMoment(moment));
  }

async recordView(userId: string, momentId: string) {
  const now = new Date();

  const moment = await this.prisma.moment.findFirst({
    where: {
      id: momentId,
      type: MomentType.PUBLIC,
      recipientId: null,
      senderId: { not: userId },
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  if (!moment) {
    throw new NotFoundException('Moment not found or not public.');
  }

  await this.prisma.momentView.upsert({
    where: {
      momentId_viewerId: {
        momentId,
        viewerId: userId,
      },
    },
    create: {
      momentId,
      viewerId: userId,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
    update: {
      viewedAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
  });

  return { message: 'Moment view recorded.' };
}



async getViews(userId: string, momentId: string) {
  const moment = await this.prisma.moment.findFirst({
    where: {
      id: momentId,
      senderId: userId,
    },
    select: {
      id: true,
    },
  });

  if (!moment) {
    throw new NotFoundException(
      'Moment not found or you do not own it.',
    );
  }

  const views = await this.prisma.momentView.findMany({
    where: {
      momentId,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      viewedAt: 'desc',
    },
    include: {
      viewer: {
        select: {
          id: true,
          name: true,
          avatarKey: true,
        },
      },
    },
  });

  return views.map((view) => ({
    viewerId: view.viewer.id,
    name: view.viewer.name,
    avatarKey: view.viewer.avatarKey,
    viewedAt: view.viewedAt,
  }));
}






  async remove(userId: string, momentId: string) {
    const moment = await this.prisma.moment.findFirst({
      where: {
        id: momentId,
        senderId: userId,
      },
    });

    if (!moment) {
      throw new NotFoundException(
        'Moment not found or you do not own it.',
      );
    }

    await this.prisma.moment.delete({
      where: { id: moment.id },
    });

    try {
      await unlink(join(UPLOAD_DIR, moment.mediaKey));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        // The database record is already deleted.
        // Log this for cleanup if the file cannot be removed.
        console.error('Could not remove uploaded media:', error);
      }
    }

    return { message: 'Moment deleted successfully.' };
  }


  // Only published public Moments can receive interactions.
  private async activePublicMoment(momentId: string) {
    const moment = await this.prisma.moment.findFirst({
      where: {
        id: momentId,
        type: MomentType.PUBLIC,
        recipientId: null,
      },
      select: { id: true, senderId: true },
    });
    if (!moment) throw new NotFoundException('Moment is unavailable or not public.');
    return moment;
  }

  

async activity(userId: string, momentId: string) {
  await this.activePublicMoment(momentId);

  const [
    comments,
    commentCount,
    giftTotal,
    wallet,
    reactionGroups,
    myReaction,
  ] = await Promise.all([
    this.prisma.momentComment.findMany({
      where: {
        momentId,
        parentId: null,
        OR: [
          { deletedAt: null },
          {
            replies: {
              some: { deletedAt: null },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarKey: true,
          },
        },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatarKey: true,
              },
            },
          },
        },
      },
    }),

    this.prisma.momentComment.count({
      where: {
        momentId,
        deletedAt: null,
      },
    }),

    this.prisma.momentBpGift.aggregate({
      where: { momentId },
      _sum: { amount: true },
    }),

    this.prisma.user.findUnique({
      where: { id: userId },
      select: { blinkPoints: true },
    }),

    this.prisma.momentReaction.groupBy({
      by: ['emoji'],
      where: { momentId },
      _count: { _all: true },
    }),

    this.prisma.momentReaction.findUnique({
      where: {
        momentId_userId: {
          momentId,
          userId,
        },
      },
      select: { emoji: true },
    }),
  ]);

  const reactionCounts: Record<string, number> = {};

  for (const group of reactionGroups) {
    reactionCounts[group.emoji] = group._count._all;
  }

  const reactionTotal = Object.values(
    reactionCounts,
  ).reduce((total, count) => total + count, 0);

  return {
    comments: comments.reverse(),
    commentCount,
    bpTotal: giftTotal._sum.amount ?? 0,
    myBalance: Number(wallet?.blinkPoints ?? 0),
    reactionCounts,
    reactionTotal,
    myReaction: myReaction?.emoji ?? null,
  };
}



  
async comment(
  userId: string,
  momentId: string,
  body: unknown,
  parentId?: unknown,
) {
  await this.activePublicMoment(momentId);

  if (
    typeof body !== 'string' ||
    !body.trim() ||
    body.trim().length > 500
  ) {
    throw new BadRequestException(
      'Comment must be 1–500 characters.',
    );
  }

  let verifiedParentId: string | null = null;

  if (parentId !== undefined && parentId !== null) {
    if (
      typeof parentId !== 'string' ||
      !parentId.trim()
    ) {
      throw new BadRequestException(
        'Invalid parent comment.',
      );
    }

    // A reply must belong to the same Moment.
    // Keep replies one level deep for organized threads.
    const parent = await this.prisma.momentComment.findFirst({
      where: {
        id: parentId,
        momentId,
        parentId: null,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!parent) {
      throw new BadRequestException(
        'The comment you are replying to is unavailable.',
      );
    }

    verifiedParentId = parent.id;
  }

  return this.prisma.momentComment.create({
    data: {
      momentId,
      authorId: userId,
      body: body.trim(),
      parentId: verifiedParentId,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          avatarKey: true,
        },
      },
    },
  });
}


 
async deleteComment(
  userId: string,
  commentId: string,
) {
  const comment = await this.prisma.momentComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      deletedAt: true,
    },
  });

  if (!comment) {
    throw new NotFoundException(
      'Comment not found.',
    );
  }

  // Only the actual comment author can delete it.
  // The Moment owner has NO special delete permission.
  if (comment.authorId !== userId) {
    throw new ForbiddenException(
      'You can only delete your own comments.',
    );
  }

  if (comment.deletedAt) {
    return { ok: true };
  }

  // Remove visible content without deleting replies
  // written by other users.
  await this.prisma.momentComment.updateMany({
    where: {
      id: commentId,
      authorId: userId,
      deletedAt: null,
    },
    data: {
      body: '[deleted]',
      deletedAt: new Date(),
    },
  });

  return { ok: true };
}


  async giftPoints(userId: string, momentId: string, amount: unknown) {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > 100) {
      throw new BadRequestException('Choose an amount between 1 and 100 BP.');
    }
    const points = amount as number;
    const moment = await this.activePublicMoment(momentId);
    if (moment.senderId === userId) {
      throw new BadRequestException('You cannot gift BP to your own Moment.');
    }

    // Conditional debit + credit + receipt in one transaction prevents
    // overdrawing a wallet or awarding BP without deducting it.
    await this.prisma.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { id: userId, blinkPoints: { gte: points } },
        data: { blinkPoints: { decrement: points } },
      });
      if (debit.count !== 1) throw new BadRequestException('Not enough BP.');
      await tx.user.update({
        where: { id: moment.senderId },
        data: { blinkPoints: { increment: points } },
      });
      await tx.momentBpGift.create({
        data: { momentId, senderId: userId, amount: points },
      });
    });
    return { ok: true };
  }

  private formatMoment(moment: {
    id: string;
    senderId: string;
    mediaKey: string;
    musicTrackId: string | null;
    caption: string | null;
    createdAt: Date;
  }) {
    return {
      id: moment.id,
      senderId: moment.senderId,
      mediaUrl: `/uploads/${encodeURIComponent(moment.mediaKey)}`,
      mediaType: /\.(mp4|webm|mov)$/i.test(moment.mediaKey)
        ? 'video'
        : 'photo',
      caption: moment.caption,
      musicTrackId: moment.musicTrackId,
      createdAt: moment.createdAt,
    };
  }
}