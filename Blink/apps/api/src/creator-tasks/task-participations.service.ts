import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SaveParticipationDto, SaveParticipationStepDto, StartParticipationVideoDto } from './task-participations.dto';

const EVIDENCE_ROOT = join(__dirname, '..', '..', 'task-media', 'participation-evidence');
const IMAGE_LIMIT = 10 * 1024 * 1024;
export const PARTICIPATION_CHUNK_SIZE = 8 * 1024 * 1024;
const VIDEO_ROOT = join(__dirname, '..', '..', 'task-media', 'participation-videos');
const CHUNKS_ROOT = join(VIDEO_ROOT, 'chunks');
const READY_ROOT = join(VIDEO_ROOT, 'ready');
const VIDEO_EXT: Record<string, string> = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const VIDEO_LIMIT = Number(process.env.PARTICIPATION_VIDEO_MAX_BYTES || 10 * 1024 ** 3);
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
};

@Injectable()
export class TaskParticipationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async publishedTask(taskId: string, userId: string) {
    const task = await this.prisma.creatorTask.findFirst({
      where: { id: taskId, status: 'PUBLISHED' },
      select: {
        id: true, creatorId: true,
        checklists: { select: { items: { select: { id: true } } } },
      },
    });
    if (!task) throw new NotFoundException('Task is not available for participation.');
    if (task.creatorId === userId) {
      throw new ForbiddenException('You cannot participate in your own creator task.');
    }
    return task;
  }

  private display(record: {
    id: string; taskId: string; explanation: string; checkedItems: unknown;
    createdAt: Date; updatedAt: Date; images: { id: string }[];
    status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED';
    submittedAt: Date | null; reviewedAt: Date | null; earnedBp: unknown;
    steps: { id: string; checklistItemId: string; explanation: string; videoUploadId: string | null;
      updatedAt: Date; reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
      reviewNote: string | null; rewardBpSnapshot: unknown;
      images: { id: string }[] }[];
  }) {
    return {
      id: record.id, taskId: record.taskId, explanation: record.explanation,
      checkedItemIds: Array.isArray(record.checkedItems)
        ? record.checkedItems.filter((item): item is string => typeof item === 'string') : [],
      images: record.images.map((image) => ({ id: image.id })),
      steps: record.steps.map((step) => ({
        id: step.id, checklistItemId: step.checklistItemId, explanation: step.explanation,
        videoUploadId: step.videoUploadId, images: step.images.map((image) => ({ id: image.id })),
        updatedAt: step.updatedAt, reviewStatus: step.reviewStatus,
        reviewNote: step.reviewNote, rewardBpSnapshot: Number(step.rewardBpSnapshot),
      })),
      status: record.status, submittedAt: record.submittedAt,
      reviewedAt: record.reviewedAt, earnedBp: Number(record.earnedBp),
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }

  async mine(userId: string, taskId: string) {
    await this.publishedTask(taskId, userId);
    const record = await this.prisma.taskParticipation.findUnique({
      where: { taskId_participantId: { taskId, participantId: userId } },
      include: { images: { orderBy: { position: 'asc' } }, steps: { orderBy: { updatedAt: 'asc' }, include: { images: { orderBy: { position: 'asc' } } } } },
    });
    return record ? this.display(record) : null;
  }

  async save(userId: string, taskId: string, input: SaveParticipationDto) {
    const task = await this.publishedTask(taskId, userId);
    const existingStatus = await this.prisma.taskParticipation.findUnique({
      where: { taskId_participantId: { taskId, participantId: userId } },
      select: { status: true },
    });
    if (existingStatus && existingStatus.status !== 'DRAFT') {
      throw new ConflictException('This submission is locked for review.');
    }
    const explanation = input.explanation.trim();
    const checked = input.checkedItemIds;
    const imageIds = input.imageIds;
    if (!Array.isArray(checked) || new Set(checked).size !== checked.length) {
      throw new BadRequestException('Checklist selections must be unique.');
    }
    const validIds = new Set(task.checklists.flatMap((group) => group.items.map((item) => item.id)));
    if (checked.some((id) => !validIds.has(id))) {
      throw new BadRequestException('A selected checklist item no longer exists in this task.');
    }
    if (!Array.isArray(imageIds) || imageIds.length > 8 || new Set(imageIds).size !== imageIds.length) {
      throw new BadRequestException('You may attach up to eight different evidence images.');
    }
    const old = await this.prisma.taskParticipation.findUnique({
      where: { taskId_participantId: { taskId, participantId: userId } },
      select: { id: true },
    });
    if (imageIds.length) {
      const found = await this.prisma.taskParticipationImage.count({
        where: {
          id: { in: imageIds }, userId,
          OR: [{ participationId: null }, ...(old ? [{ participationId: old.id }] : [])],
        },
      });
      if (found !== imageIds.length) {
        throw new BadRequestException('An image belongs to another user or another participation.');
      }
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const record = await tx.taskParticipation.upsert({
        where: { taskId_participantId: { taskId, participantId: userId } },
        create: { taskId, participantId: userId, explanation, checkedItems: checked },
        update: { explanation, checkedItems: checked },
      });
      const removed = await tx.taskParticipationImage.findMany({
        where: { participationId: record.id, id: { notIn: imageIds } },
        select: { storageKey: true },
      });
      await tx.taskParticipationImage.deleteMany({
        where: { participationId: record.id, id: { notIn: imageIds } },
      });
      for (let i = 0; i < imageIds.length; i++) {
        const updated = await tx.taskParticipationImage.updateMany({
          where: {
            id: imageIds[i], userId,
            OR: [{ participationId: null }, { participationId: record.id }],
          },
          data: { participationId: record.id, position: i },
        });
        if (updated.count !== 1) throw new ConflictException('Evidence changed while saving. Please retry.');
      }
      const saved = await tx.taskParticipation.findUniqueOrThrow({
        where: { id: record.id }, include: { images: { orderBy: { position: 'asc' } }, steps: { orderBy: { updatedAt: 'asc' }, include: { images: { orderBy: { position: 'asc' } } } } },
      });
      return { saved, removed };
    });
    await Promise.all(result.removed.map((image) =>
      unlink(join(EVIDENCE_ROOT, image.storageKey)).catch(() => {}),
    ));
    return this.display(result.saved);
  }

  private checkImage(file: Express.Multer.File) {
    const extension = EXTENSIONS[file.mimetype];
    const b = file.buffer;
    if (!extension || !b || b.length < 12 || file.size > IMAGE_LIMIT) {
      throw new BadRequestException('Choose a JPG, PNG, or WebP image under 10 MB.');
    }
    const valid = file.mimetype === 'image/jpeg'
      ? b[0] === 255 && b[1] === 216 && b[2] === 255
      : file.mimetype === 'image/png'
        ? b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    if (!valid) throw new BadRequestException('Image contents do not match the selected format.');
    return extension;
  }

  async uploadImage(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose an evidence image.');
    const extension = this.checkImage(file);
    const expired = await this.prisma.taskParticipationImage.findMany({
      where: {
        userId, participationId: null,
        createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      select: { id: true, storageKey: true },
    });
    if (expired.length) {
      await this.prisma.taskParticipationImage.deleteMany({
        where: { userId, participationId: null, id: { in: expired.map((i) => i.id) } },
      });
      await Promise.all(expired.map((item) =>
        unlink(join(EVIDENCE_ROOT, item.storageKey)).catch(() => {}),
      ));
    }
    const pending = await this.prisma.taskParticipationImage.count({
      where: { userId, participationId: null },
    });
    if (pending >= 16) {
      throw new ConflictException('Too many unfinished uploads. Save your participation first.');
    }
    await mkdir(EVIDENCE_ROOT, { recursive: true });
    const storageKey = randomUUID() + extension;
    await writeFile(join(EVIDENCE_ROOT, storageKey), file.buffer, { flag: 'wx' });
    try {
      const saved = await this.prisma.taskParticipationImage.create({
        data: { userId, storageKey, mimeType: file.mimetype, fileSize: file.size },
      });
      return { id: saved.id };
    } catch (error) {
      await unlink(join(EVIDENCE_ROOT, storageKey)).catch(() => {});
      throw error;
    }
  }

  async deleteUnattached(userId: string, imageId: string) {
    const image = await this.prisma.taskParticipationImage.findFirst({
      where: { id: imageId, userId, participationId: null },
      select: { id: true, storageKey: true },
    });
    if (!image) throw new NotFoundException('Unused image not found.');
    await this.prisma.taskParticipationImage.delete({ where: { id: image.id } });
    await unlink(join(EVIDENCE_ROOT, image.storageKey)).catch(() => {});
    return { deleted: true };
  }

  async streamImage(userId: string, imageId: string, response: Response) {
    const image = await this.prisma.taskParticipationImage.findFirst({
      where: { id: imageId, userId, OR: [{ participationId: { not: null } }, { stepId: { not: null } }] },
      select: { storageKey: true, mimeType: true },
    });
    if (!image) throw new NotFoundException('Evidence image unavailable.');
    const file = await stat(join(EVIDENCE_ROOT, image.storageKey)).catch(() => null);
    if (!file) throw new NotFoundException('Evidence image file missing.');
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Content-Length', file.size);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    createReadStream(join(EVIDENCE_ROOT, image.storageKey))
      .on('error', () => response.destroy())
      .pipe(response);
  }
  async saveChecklist(userId: string, taskId: string, checked: string[]) {
    const task = await this.publishedTask(taskId, userId);
    if (!Array.isArray(checked) || checked.length > 100 || new Set(checked).size !== checked.length) {
      throw new BadRequestException('Choose unique checklist items.');
    }
    const valid = new Set(task.checklists.flatMap((g) => g.items.map((i) => i.id)));
    if (checked.some((id) => typeof id !== 'string' || !valid.has(id))) {
      throw new BadRequestException('A selected checklist item does not belong to the task.');
    }
    const existingStatus = await this.prisma.taskParticipation.findUnique({
      where: { taskId_participantId: { taskId, participantId: userId } },
      select: { status: true },
    });
    if (existingStatus && existingStatus.status !== 'DRAFT') {
      throw new ConflictException('Submitted answers cannot be modified.');
    }
    const updated = await this.prisma.taskParticipation.upsert({
      where: { taskId_participantId: { taskId, participantId: userId } },
      create: { taskId, participantId: userId, checkedItems: checked },
      update: { checkedItems: checked },
    });
    return { checkedItemIds: checked, updatedAt: updated.updatedAt };
  }

  async saveStep(userId: string, taskId: string, itemId: string, input: SaveParticipationStepDto) {
    const task = await this.publishedTask(taskId, userId);
    if (!task.checklists.some((g) => g.items.some((i) => i.id === itemId))) {
      throw new NotFoundException('Checklist item does not belong to this task.');
    }
    const imageIds = input.imageIds;
    if (!Array.isArray(imageIds) || imageIds.length > 8 || new Set(imageIds).size !== imageIds.length) {
      throw new BadRequestException('Choose up to eight unique photos for this checklist item.');
    }
    const explanation = input.explanation.trim();
    if (explanation.length > 6000) throw new BadRequestException('Explanation exceeds 6000 characters.');
    const existing = await this.prisma.taskParticipation.findUnique({
      where: { taskId_participantId: { taskId, participantId: userId } },
      include: { steps: { where: { checklistItemId: itemId }, select: { id: true, videoUploadId: true } } },
    });
    if (existing && existing.status !== 'DRAFT') {
      throw new ConflictException('Submitted answers cannot be modified.');
    }
    const oldStep = existing?.steps[0];
    if (imageIds.length) {
      const count = await this.prisma.taskParticipationImage.count({
        where: {
          id: { in: imageIds }, userId,
          OR: [{ participationId: null, stepId: null },
            ...(oldStep ? [{ stepId: oldStep.id }] : [])],
        },
      });
      if (count !== imageIds.length) throw new BadRequestException('One or more photos are not available for this item.');
    }
    const videoId = input.videoUploadId === undefined ? oldStep?.videoUploadId ?? null : input.videoUploadId;
    if (videoId) {
      const video = await this.prisma.taskParticipationVideo.findFirst({
        where: { id: videoId, userId, completed: true },
        include: { step: { select: { id: true } } },
      });
      if (!video || (video.step && video.step.id !== oldStep?.id)) {
        throw new BadRequestException('Your video must finish uploading and cannot be used in another response.');
      }
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const participation = await tx.taskParticipation.upsert({
        where: { taskId_participantId: { taskId, participantId: userId } },
        create: { taskId, participantId: userId },
        update: {},
      });
      const lock = await tx.taskParticipation.updateMany({
        where: { id: participation.id, status: 'DRAFT' },
        data: { updatedAt: new Date() },
      });
      if (lock.count !== 1) throw new ConflictException('This submission is locked.');
      const step = await tx.taskParticipationStep.upsert({
        where: { participationId_checklistItemId: { participationId: participation.id, checklistItemId: itemId } },
        create: { participationId: participation.id, checklistItemId: itemId, explanation, videoUploadId: videoId },
        update: { explanation, videoUploadId: videoId },
      });
      const removed = await tx.taskParticipationImage.findMany({
        where: { stepId: step.id, id: { notIn: imageIds } },
        select: { storageKey: true },
      });
      await tx.taskParticipationImage.deleteMany({ where: { stepId: step.id, id: { notIn: imageIds } } });
      for (let i = 0; i < imageIds.length; i++) {
        const linked = await tx.taskParticipationImage.updateMany({
          where: { id: imageIds[i], userId,
            OR: [{ participationId: null, stepId: null }, { stepId: step.id }],
          },
          data: { stepId: step.id, position: i },
        });
        if (linked.count !== 1) throw new ConflictException('Photo was attached elsewhere. Reload and retry.');
      }
      const fresh = await tx.taskParticipationStep.findUniqueOrThrow({
        where: { id: step.id }, include: { images: { orderBy: { position: 'asc' } } },
      });
      return { fresh, removed, oldVideoId: oldStep?.videoUploadId ?? null };
    });
    await Promise.all(result.removed.map((img) => unlink(join(EVIDENCE_ROOT, img.storageKey)).catch(() => {})));
    if (result.oldVideoId && result.oldVideoId !== videoId) {
      await this.deleteDetachedVideo(userId, result.oldVideoId);
    }
    return { id: result.fresh.id, checklistItemId: result.fresh.checklistItemId,
      explanation: result.fresh.explanation, videoUploadId: result.fresh.videoUploadId,
      images: result.fresh.images.map((image) => ({ id: image.id })), updatedAt: result.fresh.updatedAt };
  }

  private async videoFor(userId: string, id: string) {
    const upload = await this.prisma.taskParticipationVideo.findFirst({ where: { id, userId } });
    if (!upload) throw new NotFoundException('Video upload not found.');
    return upload;
  }

  async startVideo(userId: string, input: StartParticipationVideoDto) {
    const ext = VIDEO_EXT[input.mimeType];
    if (!ext || !Number.isSafeInteger(input.totalBytes) || input.totalBytes <= 0 ||
      !Number.isSafeInteger(VIDEO_LIMIT) || input.totalBytes > VIDEO_LIMIT) {
      throw new BadRequestException('Use MP4, WebM or MOV within the configured video storage limit.');
    }
    // Expired sessions are removed so a failed browser upload cannot block future attempts.
    const stale = await this.prisma.taskParticipationVideo.findMany({
      where: { userId, completed: false, updatedAt: { lt: new Date(Date.now() - 48 * 3600 * 1000) } },
      select: { id: true },
    });
    for (const row of stale) {
      await this.prisma.taskParticipationVideo.deleteMany({ where: { id: row.id, userId, completed: false } });
      await rm(join(CHUNKS_ROOT, row.id), { recursive: true, force: true }).catch(() => {});
    }
    if (await this.prisma.taskParticipationVideo.count({ where: { userId, completed: false } }) >= 3) {
      throw new ConflictException('Finish or cancel an existing video upload before starting another.');
    }
    const row = await this.prisma.taskParticipationVideo.create({
      data: { userId, originalName: input.filename.slice(0, 255),
        mimeType: input.mimeType, totalBytes: BigInt(input.totalBytes),
        chunkBytes: PARTICIPATION_CHUNK_SIZE },
    });
    await mkdir(join(CHUNKS_ROOT, row.id), { recursive: true });
    return { uploadId: row.id, chunkBytes: PARTICIPATION_CHUNK_SIZE, totalChunks: Math.ceil(input.totalBytes / PARTICIPATION_CHUNK_SIZE), nextChunk: 0 };
  }

  async videoStatus(userId: string, id: string) {
    const row = await this.videoFor(userId, id);
    return { uploadId: row.id, nextChunk: row.nextChunk, chunkBytes: row.chunkBytes,
      totalChunks: Math.ceil(Number(row.totalBytes) / row.chunkBytes), completed: row.completed };
  }

  private async videoLocked<T>(id: string, callback: () => Promise<T>): Promise<T> {
    const dir = join(CHUNKS_ROOT, id);
    await mkdir(dir, { recursive: true });
    const lockPath = join(dir, '.lock');
    let lock: Awaited<ReturnType<typeof open>>;
    try { lock = await open(lockPath, 'wx'); }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new ConflictException('Video is busy; retry this chunk.');
      throw err;
    }
    try { return await callback(); }
    finally {
      await lock.close();
      await unlink(lockPath).catch(() => {});
    }
  }

  async videoChunk(userId: string, id: string, index: number, buffer?: Buffer) {
    await this.videoFor(userId, id);
    if (!buffer || buffer.length === 0 || buffer.length > PARTICIPATION_CHUNK_SIZE ||
      !Number.isSafeInteger(index) || index < 0) {
      throw new BadRequestException('Video chunk is invalid.');
    }
    return this.videoLocked(id, async () => {
      const row = await this.videoFor(userId, id);
      const count = Math.ceil(Number(row.totalBytes) / row.chunkBytes);
      if (row.completed || index >= count || (index !== row.nextChunk && index !== row.nextChunk - 1)) {
        throw new ConflictException('Video chunk is out of sequence.');
      }
      if (index === row.nextChunk - 1) return { nextChunk: row.nextChunk };
      if (buffer.length !== Math.min(row.chunkBytes, Number(row.totalBytes) - index * row.chunkBytes)) {
        throw new BadRequestException('Video chunk size is incorrect.');
      }
      await writeFile(join(CHUNKS_ROOT, id, String(index)), buffer);
      const written = await this.prisma.taskParticipationVideo.updateMany({
        where: { id, userId, nextChunk: index, completed: false },
        data: { nextChunk: { increment: 1 } },
      });
      if (!written.count) throw new ConflictException('Upload changed. Retry the chunk.');
      return { nextChunk: index + 1 };
    });
  }

  async completeVideo(userId: string, id: string) {
    await this.videoFor(userId, id);
    const result = await this.videoLocked(id, async () => {
      const row = await this.videoFor(userId, id);
      if (row.completed) return { uploadId: id };
      const count = Math.ceil(Number(row.totalBytes) / row.chunkBytes);
      if (row.nextChunk !== count) throw new BadRequestException('Video upload is incomplete.');
      const ext = VIDEO_EXT[row.mimeType];
      if (!ext) throw new BadRequestException('Invalid video type.');
      await mkdir(READY_ROOT, { recursive: true });
      const key = randomUUID() + ext;
      const assembled = join(READY_ROOT, key + '.assembling');
      const output = join(READY_ROOT, key);
      const handle = await open(assembled, 'wx');
      try {
        let written = 0;
        for (let i = 0; i < count; i++) {
          const bytes = await readFile(join(CHUNKS_ROOT, id, String(i)));
          await handle.writeFile(bytes);
          written += bytes.length;
        }
        if (BigInt(written) !== row.totalBytes) throw new BadRequestException('Video size differs from uploaded metadata.');
      } catch (err) {
        await handle.close();
        await unlink(assembled).catch(() => {});
        throw err;
      }
      await handle.close();
      await rename(assembled, output);
      await this.prisma.taskParticipationVideo.update({
        where: { id }, data: { completed: true, storageKey: key },
      });
      return { uploadId: id };
    });
    await rm(join(CHUNKS_ROOT, id), { recursive: true, force: true }).catch(() => {});
    return result;
  }

  private async deleteDetachedVideo(userId: string, id: string) {
    const video = await this.prisma.taskParticipationVideo.findFirst({
      where: { id, userId }, include: { step: { select: { id: true } } },
    });
    if (!video || video.step) return;
    await this.prisma.taskParticipationVideo.deleteMany({ where: { id, userId } });
    await rm(join(CHUNKS_ROOT, id), { recursive: true, force: true }).catch(() => {});
    if (video.storageKey) await unlink(join(READY_ROOT, video.storageKey)).catch(() => {});
  }

  async deleteUnattachedVideo(userId: string, id: string) {
    const video = await this.videoFor(userId, id);
    if (await this.prisma.taskParticipationStep.count({ where: { videoUploadId: id } })) {
      throw new ConflictException('Cannot delete video attached to a saved response.');
    }
    await this.deleteDetachedVideo(userId, video.id);
    return { deleted: true };
  }

  async assertVideoAccess(userId: string, id: string) {
    const video = await this.prisma.taskParticipationVideo.findFirst({
      where: {
        id, userId, completed: true,
        step: { is: { participation: { is: { participantId: userId } } } },
      },
    });
    if (!video?.storageKey) throw new NotFoundException('Your saved video was not found.');
    return video;
  }

  async streamVideo(id: string, response: Response, range?: string) {
    const video = await this.prisma.taskParticipationVideo.findUnique({
      where: { id }, select: { storageKey: true, mimeType: true, completed: true },
    });
    if (!video?.completed || !video.storageKey) throw new NotFoundException('Video missing.');
    const filePath = join(READY_ROOT, video.storageKey);
    const file = await stat(filePath).catch(() => null);
    if (!file || !file.size) throw new NotFoundException('Video file unavailable.');
    response.setHeader('Content-Type', video.mimeType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Accept-Ranges', 'bytes');
    let start = 0, end = file.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        response.status(416).setHeader('Content-Range', 'bytes */' + file.size).end(); return;
      }
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix < 1) {
          response.status(416).setHeader('Content-Range', 'bytes */' + file.size).end(); return;
        }
        start = Math.max(0, file.size - suffix);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(file.size - 1, Number(match[2]));
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= file.size) {
        response.status(416).setHeader('Content-Range', 'bytes */' + file.size).end(); return;
      }
      response.status(206);
      response.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + file.size);
    }
    response.setHeader('Content-Length', end - start + 1);
    createReadStream(filePath, { start, end }).on('error', () => response.destroy()).pipe(response);
  }

}
