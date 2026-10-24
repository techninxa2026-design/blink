import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { CreatorTaskStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SaveTaskDto, StartVideoDto } from './creator-tasks.dto';

export const VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;
const VIDEO_ROOT = join(__dirname, '..', '..', 'task-media');
const SESSIONS = join(VIDEO_ROOT, 'sessions');
const VIDEOS = join(VIDEO_ROOT, 'videos');
const IMAGES = join(VIDEO_ROOT, 'images');
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png',
  'image/webp': '.webp', 'image/gif': '.gif',
};
const IMAGE_LIMIT = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};
const MAX_VIDEO_BYTES = Number(process.env.TASK_MAX_VIDEO_BYTES || String(20 * 1024 ** 3));

@Injectable()
export class CreatorTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async professional(userId: string) {
    const profile = await this.prisma.businessProfile.findUnique({
      where: { userId },
      select: { id: true, type: true, active: true },
    });
    if (!profile || profile.type !== 'PROFESSIONAL') {
      throw new ForbiddenException('Save an Individual Professional profile to manage creator tasks.');
    }
    return profile;
  }

  private async mine(userId: string, id: string) {
    const task = await this.prisma.creatorTask.findFirst({ where: { id, creatorId: userId } });
    if (!task) throw new NotFoundException('Your task was not found.');
    return task;
  }

  private readonly relations = {
    creator: { select: { id: true, name: true, avatarKey: true, businessProfile: { select: { name: true } } } },
    videoUpload: { select: { completed: true } },
    images: { orderBy: { position: 'asc' as const }, select: { id: true } },
    checklists: { orderBy: { position: 'asc' as const }, include: { items: { orderBy: { position: 'asc' as const } } } },
  } as const;

  private present(row: any) {
    return {
      id: row.id, creatorId: row.creatorId, title: row.title,
      rewardBp: Number(row.rewardBp),
      images: row.images.map((image: { id: string }) => ({ id: image.id, url: row.status === 'PUBLISHED' ? '/task-media/images/' + image.id : null })),
      description: row.description, status: row.status, createdAt: row.createdAt,
      updatedAt: row.updatedAt, publishedAt: row.publishedAt,
      videoUrl: row.videoUpload?.completed && row.status === 'PUBLISHED' ? '/task-media/' + row.id : null,
      hasVideo: Boolean(row.videoUpload?.completed),
      creator: { id: row.creator.id, name: row.creator.businessProfile?.name || row.creator.name, avatarKey: row.creator.avatarKey },
      checklists: row.checklists.map((group: any) => ({
        id: group.id, name: group.name,
        items: group.items.map((item: any) => ({ id: item.id, text: item.text })),
      })),
    };
  }

  async myTasks(userId: string) {
    await this.professional(userId);
    const rows = await this.prisma.creatorTask.findMany({
      where: { creatorId: userId }, orderBy: { updatedAt: 'desc' },
      take: 100, include: this.relations,
    });
    return rows.map((row) => this.present(row));
  }

  async published(_userId: string, pageInput?: string, queryInput?: string) {
    const page = Math.min(1000, Math.max(1, Number(pageInput || '1') || 1));
    const query = (queryInput || '').trim().slice(0, 100);
    const rows = await this.prisma.creatorTask.findMany({
      where: {
        status: 'PUBLISHED',
        ...(query ? { OR: [
          { title: { contains: query } }, { description: { contains: query } },
          { creator: { businessProfile: { is: { name: { contains: query } } } } },
        ] } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 24, take: 24, include: this.relations,
    });
    return rows.map((row) => this.present(row));
  }

  async detail(userId: string, id: string) {
    const row = await this.prisma.creatorTask.findFirst({
      where: { id, OR: [{ status: 'PUBLISHED' }, { creatorId: userId }] },
      include: this.relations,
    });
    if (!row) throw new NotFoundException('Task unavailable.');
    return this.present(row);
  }

  private validate(input: SaveTaskDto) {
    const title = input.title?.trim();
    const description = input.description?.trim();
    if (!title || title.length > 140 || !description || description.length > 4000) {
      throw new BadRequestException('Task title (1–140) and description (1–4000) are required.');
    }
    if (!Array.isArray(input.checklists) || input.checklists.length > 12) {
      throw new BadRequestException('A task supports up to 12 named checklists.');
    }
    const groups = input.checklists.map((group) => {
      const name = group.name?.trim();
      if (!name || name.length > 100 || !Array.isArray(group.items) || group.items.length > 30) {
        throw new BadRequestException('Each checklist needs a name and at most 30 items.');
      }
      const items = group.items.map((entry) => entry.trim());
      if (items.some((entry) => !entry || entry.length > 240)) {
        throw new BadRequestException('Checklist items must be 1–240 characters.');
      }
      return { name, items };
    });
    if (input.status === CreatorTaskStatus.PUBLISHED && !groups.some((g) => g.items.length)) {
      throw new BadRequestException('Add at least one checklist item before publishing.');
    }
    return { title, description, groups };
  }

  private async ensureVideo(userId: string, uploadId: string | undefined | null, currentTaskId?: string) {
    if (!uploadId) return null;
    const upload = await this.prisma.taskVideoUpload.findFirst({
      where: { id: uploadId, userId, completed: true },
      include: { task: { select: { id: true } } },
    });
    if (!upload || (upload.task && upload.task.id !== currentTaskId)) {
      throw new BadRequestException('Finish uploading your own video before attaching it.');
    }
    return upload;
  }

  async save(userId: string, input: SaveTaskDto, id?: string) {
    const profile = await this.professional(userId);
    const { title, description, groups } = this.validate(input);
    const reward = input.rewardBp ?? 0;
    if (typeof reward !== 'number' || !Number.isFinite(reward) || reward < 0 ||
        reward > 5 || Math.abs(reward * 100 - Math.round(reward * 100)) > 0.000001) {
      throw new BadRequestException('Task BP must be between 0 and 5, with up to two decimal places.');
    }
    const existing = id ? await this.mine(userId, id) : null;
    const imageIds = input.imageIds ?? (existing
      ? (await this.prisma.taskImage.findMany({
        where: { taskId: existing.id }, orderBy: { position: 'asc' }, select: { id: true },
      })).map((image) => image.id)
      : []);
    if (imageIds.length > 8 || new Set(imageIds).size !== imageIds.length) {
      throw new BadRequestException('Choose up to eight unique task images.');
    }
    if (imageIds.length) {
      const owned = await this.prisma.taskImage.findMany({
        where: {
          id: { in: imageIds }, userId,
          OR: [{ taskId: null }, { taskId: existing?.id ?? '' }],
        }, select: { id: true },
      });
      if (owned.length !== imageIds.length) {
        throw new BadRequestException('An image is missing, owned by another user, or already attached to another task.');
      }
    }
    const videoId = input.videoUploadId ?? existing?.videoUploadId ?? null;
    const video = await this.ensureVideo(userId, videoId, id);
    if (input.status === 'PUBLISHED' && (!video || !profile.active)) {
      throw new BadRequestException(
        !video ? 'Upload a task video before publishing.' : 'Activate your professional profile before publishing.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const data = {
        title, description, status: input.status, rewardBp: reward.toFixed(2),
        videoUploadId: videoId,
        publishedAt: input.status === 'PUBLISHED' ? existing?.publishedAt ?? new Date() : null,
      };
      const task = existing
        ? await tx.creatorTask.update({ where: { id: existing.id }, data })
        : await tx.creatorTask.create({ data: { ...data, creatorId: userId } });

      const detached = await tx.taskImage.findMany({
        where: { taskId: task.id, id: { notIn: imageIds } },
        select: { id: true, storageKey: true },
      });
      await tx.taskImage.deleteMany({ where: { taskId: task.id, id: { notIn: imageIds } } });
      for (let i = 0; i < imageIds.length; i++) {
        await tx.taskImage.update({ where: { id: imageIds[i] }, data: { taskId: task.id, position: i } });
      }
      await tx.taskChecklist.deleteMany({ where: { taskId: task.id } });
      for (let g = 0; g < groups.length; g++) {
        await tx.taskChecklist.create({
          data: {
            taskId: task.id, name: groups[g].name, position: g,
            items: { create: groups[g].items.map((text, i) => ({ text, position: i })) },
          },
        });
      }
      return { id: task.id, status: task.status, removedImageKeys: detached.map((image) => image.storageKey) };
    }).then(async (result) => {
      await Promise.all(result.removedImageKeys.map((key) => unlink(join(IMAGES, key)).catch(() => {})));
      return { id: result.id, status: result.status };
    });
  }

  private imageFormat(file: Express.Multer.File) {
    const extension = IMAGE_EXT[file.mimetype];
    if (!extension || !file.buffer || file.size < 8 || file.size > IMAGE_LIMIT) {
      throw new BadRequestException('Use a JPEG, PNG, WebP or GIF image under 10 MB.');
    }
    const b = file.buffer;
    const good = file.mimetype === 'image/jpeg' ? b[0] === 255 && b[1] === 216 && b[2] === 255
      : file.mimetype === 'image/png' ? b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : file.mimetype === 'image/webp' ? b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
      : ['GIF87a','GIF89a'].includes(b.toString('ascii', 0, 6));
    if (!good) throw new BadRequestException('The uploaded file is not a valid image format.');
    return extension;
  }

  async uploadImage(userId: string, file?: Express.Multer.File) {
    await this.professional(userId);
    if (!file) throw new BadRequestException('Choose an image.');
    const ext = this.imageFormat(file);
    // Clean up abandoned, unattached uploads after 48 hours.
    const stale = await this.prisma.taskImage.findMany({
      where: { userId, taskId: null, createdAt: { lt: new Date(Date.now() - 48 * 3600 * 1000) } },
      select: { id: true, storageKey: true },
    });
    if (stale.length) {
      await this.prisma.taskImage.deleteMany({ where: { id: { in: stale.map((image) => image.id) }, userId, taskId: null } });
      await Promise.all(stale.map((image) => unlink(join(IMAGES, image.storageKey)).catch(() => {})));
    }
    const pending = await this.prisma.taskImage.count({ where: { userId, taskId: null } });
    if (pending >= 24) throw new ConflictException('Too many unused images. Save your task before uploading more.');
    await mkdir(IMAGES, { recursive: true });
    const key = randomUUID() + ext;
    await writeFile(join(IMAGES, key), file.buffer, { flag: 'wx' });
    try {
      const image = await this.prisma.taskImage.create({
        data: { userId, storageKey: key, mimeType: file.mimetype, fileSize: file.size },
      });
      return { id: image.id };
    } catch (error) {
      await unlink(join(IMAGES, key)).catch(() => {});
      throw error;
    }
  }

  async streamImage(id: string, response: Response, userId?: string) {
    const image = await this.prisma.taskImage.findUnique({
      where: { id },
      include: { task: { select: { status: true, creatorId: true } } },
    });
    if (!image?.task || (image.task.status !== 'PUBLISHED' && image.task.creatorId !== userId)) {
      throw new NotFoundException('Task image unavailable.');
    }
    const filePath = join(IMAGES, image.storageKey);
    const file = await stat(filePath).catch(() => null);
    if (!file) throw new NotFoundException('Task image file missing.');
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Content-Length', file.size);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', image.task.status === 'PUBLISHED' ? 'public, max-age=600' : 'private, no-store');
    createReadStream(filePath).on('error', () => response.destroy()).pipe(response);
  }

  async remove(userId: string, id: string) {
    await this.professional(userId);
    const task = await this.mine(userId, id);
    const images = await this.prisma.taskImage.findMany({
      where: { taskId: id }, select: { storageKey: true },
    });
    const participationImages = await this.prisma.taskParticipationImage.findMany({
      where: { participation: { taskId: id } },
      select: { storageKey: true },
    });
    await this.prisma.creatorTask.deleteMany({ where: { id, creatorId: userId } });
    await Promise.all(participationImages.map((image) =>
      unlink(join(VIDEO_ROOT, 'participation-evidence', image.storageKey)).catch(() => {}),
    ));
    // Keep unrelated tasks' media safe; video uploads are unique per task.
    await Promise.all(images.map((image) => unlink(join(IMAGES, image.storageKey)).catch(() => {})));
    if (task.videoUploadId) {
      const media = await this.prisma.taskVideoUpload.findUnique({
        where: { id: task.videoUploadId }, select: { storageKey: true },
      });
      await this.prisma.taskVideoUpload.deleteMany({ where: { id: task.videoUploadId, userId } });
      if (media?.storageKey) await unlink(join(VIDEOS, media.storageKey)).catch(() => {});
    }
    return { deleted: true };
  }

  async startUpload(userId: string, body: StartVideoDto) {
    await this.professional(userId);
    const stale = await this.prisma.taskVideoUpload.findMany({
      where: { userId, completed: false, updatedAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      select: { id: true },
    });
    for (const item of stale) {
      await this.prisma.taskVideoUpload.deleteMany({ where: { id: item.id, userId, completed: false } });
      await rm(join(SESSIONS, item.id), { recursive: true, force: true }).catch(() => {});
    }
    // Limit simultaneous unfinished uploads per creator.
    const unfinished = await this.prisma.taskVideoUpload.count({
      where: { userId, completed: false },
    });
    if (unfinished >= 3) {
      throw new ConflictException('You have 3 unfinished uploads. Complete them before starting another.');
    }
    const ext = MIME_EXT[body.mimeType];
    if (!ext) throw new BadRequestException('Upload an MP4, WebM, or MOV video.');
    if (!Number.isSafeInteger(body.totalBytes) || body.totalBytes <= 0 ||
        !Number.isSafeInteger(MAX_VIDEO_BYTES) || body.totalBytes > MAX_VIDEO_BYTES) {
      throw new BadRequestException('Video exceeds server capacity. Configure TASK_MAX_VIDEO_BYTES for a larger upload.');
    }
    const row = await this.prisma.taskVideoUpload.create({
      data: { userId, originalName: body.filename.slice(0, 255), mimeType: body.mimeType, totalBytes: BigInt(body.totalBytes), chunkBytes: VIDEO_CHUNK_BYTES },
    });
    await mkdir(join(SESSIONS, row.id), { recursive: true });
    return { uploadId: row.id, chunkBytes: VIDEO_CHUNK_BYTES, nextChunk: 0, totalChunks: Math.ceil(body.totalBytes / VIDEO_CHUNK_BYTES) };
  }

  private async ownedUpload(userId: string, id: string) {
    await this.professional(userId);
    const row = await this.prisma.taskVideoUpload.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Upload session not found.');
    return row;
  }

  async uploadStatus(userId: string, id: string) {
    const row = await this.ownedUpload(userId, id);
    return { uploadId: row.id, chunkBytes: row.chunkBytes, nextChunk: row.nextChunk, completed: row.completed, totalChunks: Math.ceil(Number(row.totalBytes) / row.chunkBytes) };
  }

  private async locked<T>(id: string, cb: () => Promise<T>): Promise<T> {
    const folder = join(SESSIONS, id);
    await mkdir(folder, { recursive: true });
    const lockPath = join(folder, '.lock');
    let lock;
    try {
      lock = await open(lockPath, 'wx');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new ConflictException('Upload is busy. Retry this chunk.');
      }
      throw err;
    }
    try {
      return await cb();
    } finally {
      await lock.close();
      await unlink(lockPath).catch(() => {});
    }
  }

  async uploadChunk(userId: string, id: string, index: number, buffer?: Buffer) {
    if (!buffer || buffer.length === 0 || buffer.length > VIDEO_CHUNK_BYTES || !Number.isSafeInteger(index) || index < 0) {
      throw new BadRequestException('Invalid video chunk.');
    }
    await this.ownedUpload(userId, id);
    return this.locked(id, async () => {
      const row = await this.ownedUpload(userId, id);
      const chunks = Math.ceil(Number(row.totalBytes) / row.chunkBytes);
      const expected = Number(row.totalBytes) - index * row.chunkBytes;
      if (row.completed || index >= chunks || (index !== row.nextChunk && index !== row.nextChunk - 1)) {
        throw new ConflictException('Chunk is out of sequence.');
      }
      if (index === row.nextChunk - 1) return { nextChunk: row.nextChunk };
      if (buffer.length !== Math.min(row.chunkBytes, expected)) {
        throw new BadRequestException('Chunk length does not match upload metadata.');
      }
      const target = join(SESSIONS, id, String(index));
      await writeFile(target, buffer);
      const updated = await this.prisma.taskVideoUpload.updateMany({
        where: { id, userId, nextChunk: index, completed: false },
        data: { nextChunk: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Upload session changed. Retry.');
      return { nextChunk: index + 1 };
    });
  }

  async finishUpload(userId: string, id: string) {
    const upload = await this.ownedUpload(userId, id);
    if (upload.completed) return { uploadId: id };
    const result = await this.locked(id, async () => {
      const row = await this.ownedUpload(userId, id);
      if (row.completed) return { uploadId: id };
      const count = Math.ceil(Number(row.totalBytes) / row.chunkBytes);
      if (row.nextChunk !== count) throw new BadRequestException('Video upload is incomplete.');
      const ext = MIME_EXT[row.mimeType];
      if (!ext) throw new BadRequestException('Invalid video format.');
      await mkdir(VIDEOS, { recursive: true });
      const key = randomUUID() + ext;
      const output = join(VIDEOS, key);
      const part = output + '.assembling';
      const handle = await open(part, 'wx');
      try {
        let written = 0;
        for (let i = 0; i < count; i++) {
          const chunk = await readFile(join(SESSIONS, id, String(i)));
          await handle.writeFile(chunk);
          written += chunk.length;
        }
        if (BigInt(written) !== row.totalBytes) throw new BadRequestException('Uploaded video length mismatch.');
      } catch (err) {
        await handle.close();
        await unlink(part).catch(() => {});
        throw err;
      }
      await handle.close();
      await rename(part, output);
      await this.prisma.taskVideoUpload.update({
        where: { id }, data: { completed: true, storageKey: key },
      });
      return { uploadId: id };
    });
    // Remove chunk files only after releasing the lock (important on Windows).
    await rm(join(SESSIONS, id), { recursive: true, force: true }).catch(() => {});
    return result;
  }

  async cancelUpload(userId: string, id: string) {
    const upload = await this.ownedUpload(userId, id);
    if (upload.completed) {
      const linked = await this.prisma.creatorTask.count({ where: { videoUploadId: id } });
      if (linked) throw new ConflictException('This video is attached to a task.');
    }
    await this.prisma.taskVideoUpload.deleteMany({ where: { id, userId } });
    await rm(join(SESSIONS, id), { recursive: true, force: true }).catch(() => {});
    if (upload.storageKey) await unlink(join(VIDEOS, upload.storageKey)).catch(() => {});
    return { cancelled: true };
  }

  async streamVideo(id: string, response: Response, range?: string) {
    const task = await this.prisma.creatorTask.findFirst({
      where: { id, status: 'PUBLISHED' },
      include: { videoUpload: { select: { storageKey: true, mimeType: true, completed: true } } },
    });
    const video = task?.videoUpload;
    if (!video?.completed || !video.storageKey) throw new NotFoundException('Video unavailable.');
    const path = join(VIDEOS, video.storageKey);
    const file = await stat(path).catch(() => null);
    if (!file || file.size === 0) throw new NotFoundException('Video file unavailable.');

    response.setHeader('Content-Type', video.mimeType);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Cache-Control', 'public, max-age=1800');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    let start = 0;
    let end = file.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        response.status(416).setHeader('Content-Range', 'bytes */' + file.size).end();
        return;
      }
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix < 1) {
          response.status(416).setHeader('Content-Range', 'bytes */' + file.size).end();
          return;
        }
        start = Math.max(0, file.size - suffix);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(file.size - 1, Number(match[2]));
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= file.size) {
        response.status(416).setHeader('Content-Range', 'bytes */' + file.size).end();
        return;
      }
      response.status(206);
      response.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + file.size);
    }
    response.setHeader('Content-Length', end - start + 1);
    createReadStream(path, { start, end }).on('error', () => response.destroy()).pipe(response);
  }
}
