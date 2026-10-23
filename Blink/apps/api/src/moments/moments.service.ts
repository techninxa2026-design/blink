import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MomentType } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');

@Injectable()
export class MomentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    file: Express.Multer.File,
    caption?: string,
  ) {
    const moment = await this.prisma.moment.create({
      data: {
        senderId: userId,
        type: MomentType.PUBLIC,
        mediaKey: file.filename,
        caption: caption?.trim() || null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return this.formatMoment(moment);
  }

  async findFeed() {
    const moments = await this.prisma.moment.findMany({
      where: {
        type: MomentType.PUBLIC,
        recipientId: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        sender: {
          select: { id: true, name: true, avatarKey: true },
        },
      },
    });

    return moments.map((moment) => ({
      ...this.formatMoment(moment),
      sender: moment.sender,
    }));
  }

  async findMine(userId: string) {
    const moments = await this.prisma.moment.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return moments.map((moment) => this.formatMoment(moment));
  }

async recordView(userId: string, momentId: string) {
  const now = new Date();

  const moment = await this.prisma.moment.findFirst({
    where: {
      id: momentId,
      type: MomentType.PUBLIC,
      recipientId: null,
      senderId: { not: userId },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  if (!moment) {
    throw new NotFoundException('Moment not found or has expired.');
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
      expiresAt:
        moment.expiresAt ??
        new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    update: {
      viewedAt: now,
      expiresAt:
        moment.expiresAt ??
        new Date(Date.now() + 24 * 60 * 60 * 1000),
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


  // Only published, non-expired public Moments can receive interactions.
  private async activePublicMoment(momentId: string) {
    const moment = await this.prisma.moment.findFirst({
      where: {
        id: momentId,
        type: MomentType.PUBLIC,
        recipientId: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, senderId: true },
    });
    if (!moment) throw new NotFoundException('Moment is unavailable or expired.');
    return moment;
  }

  async activity(userId: string, momentId: string) {
    await this.activePublicMoment(momentId);
    const [comments, commentCount, giftTotal, wallet] = await Promise.all([
      this.prisma.momentComment.findMany({
        where: { momentId },
        orderBy: { createdAt: 'desc' },
        take: 60,
        include: { author: { select: { id: true, name: true, avatarKey: true } } },
      }),
      this.prisma.momentComment.count({ where: { momentId } }),
      this.prisma.momentBpGift.aggregate({
        where: { momentId },
        _sum: { amount: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { blinkPoints: true } }),
    ]);
    return {
      comments: comments.reverse().map(({ author, ...comment }) => ({ ...comment, author })),
      commentCount,
      bpTotal: giftTotal._sum.amount ?? 0,
      myBalance: wallet?.blinkPoints ?? 0,
    };
  }

  async comment(userId: string, momentId: string, body: unknown) {
    await this.activePublicMoment(momentId);
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 500) {
      throw new BadRequestException('Comment must be 1–500 characters.');
    }
    return this.prisma.momentComment.create({
      data: { momentId, authorId: userId, body: body.trim() },
      include: { author: { select: { id: true, name: true, avatarKey: true } } },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.momentComment.findUnique({
      where: { id: commentId },
      include: { moment: { select: { senderId: true } } },
    });
    if (!comment || (comment.authorId !== userId && comment.moment.senderId !== userId)) {
      throw new NotFoundException('Comment unavailable.');
    }
    await this.prisma.momentComment.delete({ where: { id: commentId } });
    return { ok: true };
  }

  async giftPoints(userId: string, momentId: string, amount: unknown) {
    if (!Number.isInteger(amount) || (amount as number) < 1 || (amount as number) > 100) {
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
      createdAt: moment.createdAt,
    };
  }
}