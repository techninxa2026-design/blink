import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskReviewService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedTask(creatorId: string, taskId: string) {
    const task = await this.prisma.creatorTask.findFirst({
      where: { id: taskId, creatorId },
      select: { id: true, title: true, status: true },
    });
    if (!task) throw new ForbiddenException('Only this task creator can review answers.');
    return task;
  }

  async submit(participantId: string, taskId: string) {
    const task = await this.prisma.creatorTask.findFirst({
      where: { id: taskId, status: 'PUBLISHED' },
      select: {
        id: true, creatorId: true,
        checklists: { include: { items: { select: { id: true, rewardBp: true } } } },
      },
    });
    if (!task) throw new NotFoundException('Published task not found.');
    if (task.creatorId === participantId) {
      throw new ForbiddenException('You cannot submit an answer to your own task.');
    }
    const rewardMap = new Map(task.checklists.flatMap((g) =>
      g.items.map((item) => [item.id, item.rewardBp] as const)));
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.taskParticipation.findUnique({
        where: { taskId_participantId: { taskId, participantId } },
        include: { steps: { include: { images: { select: { id: true } } } } },
      });
      if (!record || !record.steps.length) {
        throw new BadRequestException('Save a checklist-item answer before submitting.');
      }
      if (record.status !== 'DRAFT') {
        throw new ConflictException('This participation was already submitted.');
      }
      if (record.steps.some((step) => !rewardMap.has(step.checklistItemId))) {
        throw new ConflictException('The creator changed a checklist item. Please contact the creator.');
      }
      if (record.steps.some((step) =>
        !step.explanation.trim() && !step.images.length && !step.videoUploadId)) {
        throw new BadRequestException('Every saved item needs an explanation, photo, or video before submission.');
      }
      const changed = await tx.taskParticipation.updateMany({
        where: { id: record.id, status: 'DRAFT' },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('Already submitted.');
      for (const step of record.steps) {
        const amount = rewardMap.get(step.checklistItemId);
        if (!amount) throw new ConflictException('A checklist item is no longer available.');
        await tx.taskParticipationStep.update({
          where: { id: step.id },
          data: { reviewStatus: 'PENDING', reviewNote: null,
            rewardBpSnapshot: amount, reviewedAt: null },
        });
      }
      return { status: 'SUBMITTED' as const, submittedAt: new Date(), submittedItems: record.steps.length };
    });
  }

  async list(creatorId: string, taskId: string) {
    const task = await this.ownedTask(creatorId, taskId);
    const submissions = await this.prisma.taskParticipation.findMany({
      where: { taskId, status: { in: ['SUBMITTED', 'REVIEWED'] } },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      take: 250,
      include: {
        participant: { select: { id: true, name: true, avatarKey: true } },
        steps: { orderBy: { createdAt: 'asc' }, include: { images: { select: { id: true } } } },
      },
    });
    const items = await this.prisma.taskChecklistItem.findMany({
      where: { checklist: { taskId } },
      select: { id: true, text: true, rewardBp: true, checklist: { select: { name: true } } },
    });
    const lookup = new Map(items.map((item) => [item.id, item]));
    return {
      task,
      submissions: submissions.map((entry) => ({
        id: entry.id, status: entry.status, submittedAt: entry.submittedAt,
        reviewedAt: entry.reviewedAt, earnedBp: Number(entry.earnedBp),
        participant: entry.participant,
        steps: entry.steps.map((step) => ({
          id: step.id, checklistItemId: step.checklistItemId,
          title: lookup.get(step.checklistItemId)?.text ?? 'Previous checklist item',
          group: lookup.get(step.checklistItemId)?.checklist.name ?? 'Checklist',
          rewardBp: Number(step.rewardBpSnapshot), explanation: step.explanation,
          imageIds: step.images.map((image) => image.id),
          videoUploadId: step.videoUploadId, status: step.reviewStatus,
          note: step.reviewNote, reviewedAt: step.reviewedAt,
        })),
      })),
    };
  }

  async review(creatorId: string, taskId: string, participationId: string,
    stepId: string, verdict: 'APPROVED' | 'REJECTED', note?: string) {
    await this.ownedTask(creatorId, taskId);
    if (verdict !== 'APPROVED' && verdict !== 'REJECTED') {
      throw new BadRequestException('Decision must be APPROVED or REJECTED.');
    }
    if (note && note.length > 500) throw new BadRequestException('Review note is too long.');
    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize reviews for one participation; one-time rewards even under concurrent requests.
      const locked = await tx.taskParticipation.updateMany({
        where: { id: participationId, taskId, status: 'SUBMITTED' },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) {
        throw new ConflictException('Submission has already been reviewed or is unavailable.');
      }
      const step = await tx.taskParticipationStep.findFirst({
        where: { id: stepId, participationId, reviewStatus: 'PENDING' },
        include: { participation: { select: { participantId: true } } },
      });
      if (!step) throw new ConflictException('This checklist answer was already reviewed.');
      const updated = await tx.taskParticipationStep.updateMany({
        where: { id: step.id, reviewStatus: 'PENDING' },
        data: { reviewStatus: verdict, reviewNote: note?.trim() || null, reviewedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException('Already reviewed.');
      const amount = step.rewardBpSnapshot;
      if (verdict === 'APPROVED' && Number(amount) > 0) {
        await tx.taskRewardReceipt.create({
          data: { stepId: step.id, userId: step.participation.participantId, amount },
        });
        await tx.user.update({
          where: { id: step.participation.participantId },
          data: { blinkPoints: { increment: amount } },
        });
        await tx.taskParticipation.update({
          where: { id: participationId }, data: { earnedBp: { increment: amount } },
        });
      }
      const pending = await tx.taskParticipationStep.count({
        where: { participationId, reviewStatus: 'PENDING' },
      });
      if (pending === 0) {
        await tx.taskParticipation.update({
          where: { id: participationId },
          data: { status: 'REVIEWED', reviewedAt: new Date() },
        });
      }
      const updatedParticipation = await tx.taskParticipation.findUniqueOrThrow({
        where: { id: participationId },
        select: { status: true, earnedBp: true },
      });
      return { status: updatedParticipation.status,
        earnedBp: Number(updatedParticipation.earnedBp),
        reviewedItem: step.id, decision: verdict,
        awardedBp: verdict === 'APPROVED' ? Number(amount) : 0 };
    });
    return result;
  }
}
