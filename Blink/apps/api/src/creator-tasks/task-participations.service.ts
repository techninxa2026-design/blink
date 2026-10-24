import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SaveParticipationDto } from './task-participations.dto';

const EVIDENCE_ROOT = join(__dirname, '..', '..', 'task-media', 'participation-evidence');
const IMAGE_LIMIT = 10 * 1024 * 1024;
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
  }) {
    return {
      id: record.id, taskId: record.taskId, explanation: record.explanation,
      checkedItemIds: Array.isArray(record.checkedItems)
        ? record.checkedItems.filter((item): item is string => typeof item === 'string') : [],
      images: record.images.map((image) => ({ id: image.id })),
      status: 'DRAFT' as const,
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }

  async mine(userId: string, taskId: string) {
    await this.publishedTask(taskId, userId);
    const record = await this.prisma.taskParticipation.findUnique({
      where: { taskId_participantId: { taskId, participantId: userId } },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    return record ? this.display(record) : null;
  }

  async save(userId: string, taskId: string, input: SaveParticipationDto) {
    const task = await this.publishedTask(taskId, userId);
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
        where: { id: record.id }, include: { images: { orderBy: { position: 'asc' } } },
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
      where: { id: imageId, userId, participationId: { not: null } },
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
}
