import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';

export const REELS_ROOT = join(process.cwd(), 'reels-storage');
export const REEL_VIDEO_DIR = join(REELS_ROOT, 'videos');
export const REEL_COVER_DIR = join(REELS_ROOT, 'covers');
export const REEL_MAX_BYTES = 200 * 1024 * 1024;
const REACTION_EMOJIS = ['❤️','😂','😍','😮','😢','👍','🔥'] as const;

@Injectable()
export class ReelsService {
  constructor(private readonly prisma: PrismaService, private readonly inbox: InboxService) {}

  private async requireReel(id: string) {
    const reel = await this.prisma.reel.findUnique({ where: { id } });
    if (!reel) throw new NotFoundException('Reel not found.');
    return reel;
  }

  private async formatted(reel: {
    id: string; authorId: string; caption: string | null; createdAt: Date;
    durationSeconds: number | null; coverTimeSeconds: number;
    author: { id: string; name: string; avatarKey: string | null };
    _count: { views: number; comments: number; reactions: number };
  }, viewerId: string) {
    const my = await this.prisma.reelReaction.findUnique({
      where: { reelId_userId: { reelId: reel.id, userId: viewerId } },
      select: { emoji: true },
    });
    return {
      id: reel.id, authorId: reel.authorId, author: reel.author,
      caption: reel.caption, createdAt: reel.createdAt,
      durationSeconds: reel.durationSeconds, coverTimeSeconds: reel.coverTimeSeconds,
      videoUrl: '/reels/media/' + encodeURIComponent(reel.id) + '/stream',
      thumbnailUrl: '/reels/media/' + encodeURIComponent(reel.id) + '/thumbnail',
      views: reel._count.views, reactionCount: reel._count.reactions,
      commentCount: reel._count.comments,
      myReaction: my?.emoji ?? null,
    };
  }
  private readonly include = {
    author: { select: { id: true, name: true, avatarKey: true } },
    _count: { select: { views: true, comments: { where: { deletedAt: null } }, reactions: true } },
  } as const;

  async feed(userId: string, skip = 0) {
    if (!Number.isSafeInteger(skip) || skip < 0 || skip > 5000) throw new BadRequestException('Invalid offset.');
    const rows = await this.prisma.reel.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip, take: 21, include: this.include,
    });
    return {
      items: await Promise.all(rows.slice(0, 20).map((row) => this.formatted(row, userId))),
      nextOffset: rows.length > 20 ? skip + 20 : null,
    };
  }

  async mine(userId: string, authorId?: string) {
    const user = authorId || userId;
    const rows = await this.prisma.reel.findMany({
      where: { authorId: user },
      orderBy: { createdAt: 'desc' }, take: 150, include: this.include,
    });
    return Promise.all(rows.map((row) => this.formatted(row, userId)));
  }

  async detail(userId: string, reelId: string) {
    const row = await this.prisma.reel.findUnique({
      where: { id: reelId }, include: this.include,
    });
    if (!row) throw new NotFoundException('Reel unavailable.');
    return this.formatted(row, userId);
  }

  async create(userId: string, files: { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
    caption: unknown, duration: unknown, coverTime: unknown) {
    const video = files.video?.[0], cover = files.thumbnail?.[0];
    const cleanup = async () => {
      await Promise.all([video?.path, cover?.path].filter((x): x is string => !!x)
        .map((x) => unlink(x).catch(() => {})));
    };
    try {
      if (!video || !cover) throw new BadRequestException('Choose a video and its cover frame.');
      if (!['video/mp4','video/webm','video/quicktime'].includes(video.mimetype) ||
          video.size <= 0 || video.size > REEL_MAX_BYTES) {
        throw new BadRequestException('Choose MP4, MOV or WebM video under 200 MB.');
      }
      if (cover.mimetype !== 'image/jpeg' || cover.size <= 0 || cover.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Reel thumbnail must be JPG under 5 MB.');
      }
      const bytes = await readFile(cover.path);
      if (bytes.length < 3 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) {
        throw new BadRequestException('Thumbnail is not a JPEG image.');
      }
      const desc = typeof caption === 'string' ? caption.trim() : '';
      if (desc.length > 1000) throw new BadRequestException('Caption cannot exceed 1000 characters.');
      const durationSeconds = Number(duration);
      const coverTimeSeconds = Number(coverTime);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 300 ||
          !Number.isFinite(coverTimeSeconds) || coverTimeSeconds < 0 ||
          coverTimeSeconds > durationSeconds) {
        throw new BadRequestException('Reels must be 1–300 seconds. Choose a valid thumbnail time.');
      }
      // Unknown MIME, blank/empty or arbitrary shell files are never served as HTML.
      const row = await this.prisma.reel.create({
        data: {
          authorId: userId, videoKey: video.filename, thumbnailKey: cover.filename,
          videoMime: video.mimetype, caption: desc || null, durationSeconds, coverTimeSeconds,
        },
        include: this.include,
      });
      return this.formatted(row, userId);
    } catch (err) {
      await cleanup();
      throw err;
    }
  }

  async view(userId: string, reelId: string) {
    const reel = await this.requireReel(reelId);
    if (reel.authorId !== userId) await this.prisma.reelView.upsert({
      where: { reelId_viewerId: { reelId, viewerId: userId } },
      update: {}, create: { reelId, viewerId: userId },
    });
    return { views: await this.prisma.reelView.count({ where: { reelId } }) };
  }

  async react(userId: string, reelId: string, emoji: unknown) {
    await this.requireReel(reelId);
    if (emoji !== null && (typeof emoji !== 'string' ||
      !REACTION_EMOJIS.includes(emoji as typeof REACTION_EMOJIS[number]))) {
      throw new BadRequestException('Choose a supported reaction.');
    }
    const where = { reelId_userId: { reelId, userId } };
    const previous = await this.prisma.reelReaction.findUnique({ where });
    if (emoji === null || previous?.emoji === emoji) {
      await this.prisma.reelReaction.deleteMany({ where: { reelId, userId } });
    } else {
      await this.prisma.reelReaction.upsert({
        where, create: { reelId, userId, emoji: emoji as string },
        update: { emoji: emoji as string },
      });
    }
    return {
      myReaction: emoji === null || previous?.emoji === emoji ? null : emoji,
      reactionCount: await this.prisma.reelReaction.count({ where: { reelId } }),
    };
  }

  async comments(reelId: string) {
    await this.requireReel(reelId);
    const rows = await this.prisma.reelComment.findMany({
      where: { reelId }, take: 300, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { author: { select: { id: true, name: true, avatarKey: true } } },
    });
    const byId = new Map(rows.map((r) => [r.id, { ...r, replies: [] as unknown[] }]));
    const roots: unknown[] = [];
    for (const row of byId.values()) {
      if (row.parentId && byId.has(row.parentId)) byId.get(row.parentId)?.replies.push(row);
      else roots.push(row);
    }
    return roots;
  }

  async comment(userId: string, reelId: string, body: unknown, parentId?: unknown) {
    await this.requireReel(reelId);
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 600) {
      throw new BadRequestException('Comment must be 1–600 characters.');
    }
    let rootId: string | null = null;
    if (parentId !== null && parentId !== undefined) {
      if (typeof parentId !== 'string') throw new BadRequestException('Invalid reply target.');
      const parent = await this.prisma.reelComment.findUnique({ where: { id: parentId } });
      if (!parent || parent.reelId !== reelId || parent.deletedAt) {
        throw new BadRequestException('Reply target is unavailable.');
      }
      rootId = parent.parentId || parent.id;
    }
    return this.prisma.reelComment.create({
      data: { reelId, authorId: userId, body: body.trim(), parentId: rootId },
      include: { author: { select: { id: true, name: true, avatarKey: true } } },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.reelComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment unavailable.');
    if (comment.authorId !== userId) throw new ForbiddenException('You can only delete your own comment.');
    await this.prisma.reelComment.update({
      where: { id: commentId }, data: { deletedAt: new Date(), body: '[deleted]' },
    });
    return { deleted: true };
  }

  async remove(userId: string, reelId: string) {
    const reel = await this.requireReel(reelId);
    if (reel.authorId !== userId) throw new ForbiddenException('Only the creator can delete their Reel.');
    await this.prisma.reel.delete({ where: { id: reelId } });
    await Promise.all([
      unlink(join(REEL_VIDEO_DIR, reel.videoKey)).catch(() => {}),
      unlink(join(REEL_COVER_DIR, reel.thumbnailKey)).catch(() => {}),
    ]);
    return { deleted: true };
  }

  async share(userId: string, reelId: string, friendIds: unknown, webOrigin?: string) {
    const reel = await this.requireReel(reelId);
    if (!Array.isArray(friendIds) || friendIds.length < 1 || friendIds.length > 10 ||
      friendIds.some((id) => typeof id !== 'string' || !id || id === userId) ||
      new Set(friendIds).size !== friendIds.length) {
      throw new BadRequestException('Choose 1–10 different friends.');
    }
    // Check friendship and blocking for all recipients before sending anything.
    for (const friendId of friendIds as string[]) {
      const [friendship, blocked] = await Promise.all([
        this.prisma.friendship.findFirst({ where: { OR: [
          { userAId: userId, userBId: friendId }, { userAId: friendId, userBId: userId },
        ] } }),
        this.prisma.userBlock.findFirst({ where: { OR: [
          { blockerId: userId, blockedId: friendId }, { blockerId: friendId, blockedId: userId },
        ] } }),
      ]);
      if (!friendship || blocked) throw new ForbiddenException('You can share Reels only with unblocked friends.');
    }
    const permittedOrigins = [
      'http://localhost:5173', 'http://127.0.0.1:5173',
      ...(process.env.CORS_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean),
    ];
    const origin = typeof webOrigin === 'string' && permittedOrigins.includes(webOrigin)
      ? webOrigin : (process.env.WEB_APP_URL || 'http://localhost:5173');
    const link = origin.replace(/\/$/,'') + '/reels/' + encodeURIComponent(reel.id);
    const creator = await this.prisma.user.findUnique({
      where: { id: reel.authorId }, select: { name: true },
    });
    const inboxDir = join(process.cwd(), 'inbox-storage', 'inbox-media');
    await mkdir(inboxDir, { recursive: true });
    const sent: string[] = [];
    for (const friendId of friendIds as string[]) {
      const conversation = await this.inbox.openConversation(userId, friendId);
      const fileKey = randomUUID() + '.jpg';
      await copyFile(join(REEL_COVER_DIR, reel.thumbnailKey), join(inboxDir, fileKey));
      try {
        const message = await this.prisma.message.create({
          data: {
            conversationId: conversation.conversationId, senderId: userId,
            body: '🎬 Reel by ' + (creator?.name ?? 'Blink creator') + '\n' + link,
            mediaKey: fileKey, mediaType: 'image', mediaMime: 'image/jpeg',
          },
        });
        await this.prisma.conversation.update({
          where: { id: conversation.conversationId }, data: { updatedAt: new Date() },
        });
        sent.push(message.id);
      } catch (err) {
        await unlink(join(inboxDir, fileKey)).catch(() => {});
        throw err;
      }
    }
    return { sent: sent.length, messageIds: sent, url: link };
  }

  async stream(reelId: string, kind: 'video' | 'cover', res: Response, range?: string) {
    const reel = await this.requireReel(reelId);
    const video = kind === 'video';
    const filePath = join(video ? REEL_VIDEO_DIR : REEL_COVER_DIR, video ? reel.videoKey : reel.thumbnailKey);
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) throw new NotFoundException('Reel media not available.');
    res.setHeader('Content-Type', video ? reel.videoMime : 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!video) {
      res.setHeader('Content-Length', info.size);
      createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
      return;
    }
    res.setHeader('Accept-Ranges', 'bytes');
    let start = 0, end = info.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        res.status(416).setHeader('Content-Range', 'bytes */' + info.size).end(); return;
      }
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) {
          res.status(416).setHeader('Content-Range', 'bytes */' + info.size).end(); return;
        }
        start = Math.max(0, info.size - suffix);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(info.size - 1, Number(match[2]));
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 ||
          start > end || start >= info.size) {
        res.status(416).setHeader('Content-Range', 'bytes */' + info.size).end(); return;
      }
      res.status(206);
      res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + info.size);
    }
    res.setHeader('Content-Length', end - start + 1);
    createReadStream(filePath, { start, end }).on('error', () => res.destroy()).pipe(res);
  }
}
