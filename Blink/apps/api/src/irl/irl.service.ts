import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const categories = ['Hangout', 'Sports', 'Gaming', 'Food', 'Shopping', 'Other'];
@Injectable()
export class IrlService {
  constructor(private readonly prisma: PrismaService) {}
  private async friendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    return rows.map(r => r.userAId === userId ? r.userBId : r.userAId);
  }
  async list(userId: string) {
    const friends = await this.friendIds(userId);
    const plans = await this.prisma.irlPlan.findMany({
      where: { creatorId: { in: [userId, ...friends] } },
      include: {
        creator: { select: { id: true, name: true, avatarKey: true } },
        invitations: { include: { recipient: { select: { id: true, name: true, avatarKey: true } } }, orderBy: { createdAt: 'asc' } },
        interests: { include: { user: { select: { id: true, name: true, avatarKey: true } } }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return plans.map(plan => ({ ...plan, invitations: plan.creatorId === userId ? plan.invitations : plan.invitations.filter(inv => inv.recipientId === userId) }));
  }
  async create(userId: string, input: unknown) {
    const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const category = typeof body.category === 'string' ? body.category : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const place = typeof body.place === 'string' ? body.place.trim() : '';
    const startsAt = typeof body.startsAt === 'string' ? new Date(body.startsAt) : new Date(NaN);
    if (!title || title.length > 120) throw new BadRequestException('Title must be 1–120 characters.');
    if (!categories.includes(category)) throw new BadRequestException('Invalid category.');
    if (description.length > 1000 || place.length > 180) throw new BadRequestException('Description or place is too long.');
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) throw new BadRequestException('Choose a future date and time.');
    return this.prisma.irlPlan.create({ data: { creatorId: userId, title, category, description: description || null, place: place || null, startsAt } });
  }
  async remove(userId: string, id: string) {
    const result = await this.prisma.irlPlan.deleteMany({ where: { id, creatorId: userId } });
    if (!result.count) throw new NotFoundException('Your plan was not found.');
    return { deleted: true };
  }
  async interest(userId: string, id: string, input: unknown) {
    const plan = await this.prisma.irlPlan.findUnique({ where: { id }, select: { creatorId: true, startsAt: true } });
    if (!plan) throw new NotFoundException('Plan not found.');
    if (plan.creatorId === userId) throw new ForbiddenException('You cannot respond to your own plan.');
    if (plan.startsAt.getTime() <= Date.now()) throw new BadRequestException('This plan has already started.');
    const friends = await this.friendIds(userId);
    if (!friends.includes(plan.creatorId)) throw new ForbiddenException('Only friends can respond.');
    const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const reply = typeof body.reply === 'string' ? body.reply.trim() : '';
    if (reply.length > 500) throw new BadRequestException('Reply must be 500 characters or fewer.');
    return this.prisma.irlInterest.upsert({
      where: { planId_userId: { planId: id, userId } },
      create: { planId: id, userId, reply },
      update: { reply },
    });
  }
  async withdraw(userId: string, id: string) {
    await this.prisma.irlInterest.deleteMany({ where: { planId: id, userId } });
    return { deleted: true };
  }
  async invitations(userId: string) {
    return this.prisma.irlInvitation.findMany({
      where: { recipientId: userId },
      include: { plan: { include: { creator: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  async invite(userId: string, planId: string, recipientId: string) {
    if (!recipientId) throw new BadRequestException('Select an interested friend.');
    const plan = await this.prisma.irlPlan.findUnique({ where: { id: planId }, select: { creatorId: true, startsAt: true } });
    if (!plan) throw new NotFoundException('Plan not found.');
    if (plan.creatorId !== userId) throw new ForbiddenException('Only the plan creator can invite friends.');
    if (plan.startsAt <= new Date()) throw new BadRequestException('Cannot invite to a plan that has started.');
    const interested = await this.prisma.irlInterest.findUnique({ where: { planId_userId: { planId, userId: recipientId } } });
    if (!interested) throw new BadRequestException('This friend has not expressed interest.');
    const friends = await this.friendIds(userId);
    if (!friends.includes(recipientId)) throw new ForbiddenException('You can only invite your friends.');
    return this.prisma.irlInvitation.upsert({
      where: { planId_recipientId: { planId, recipientId } },
      create: { planId, recipientId },
      update: {},
    });
  }

  async respondInvitation(userId: string, invitationId: string, status: unknown) {
    if (status !== 'ACCEPTED' && status !== 'DECLINED') throw new BadRequestException('Choose ACCEPTED or DECLINED.');
    const invitation = await this.prisma.irlInvitation.findUnique({
      where: { id: invitationId }, include: { plan: { select: { startsAt: true, creatorId: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    if (invitation.recipientId !== userId) throw new ForbiddenException('This invitation is not yours.');
    if (invitation.status !== 'PENDING') throw new BadRequestException('Invitation already answered.');
    if (invitation.plan.startsAt <= new Date()) throw new BadRequestException('This plan has already started.');
    const friends = await this.friendIds(userId);
    if (!friends.includes(invitation.plan.creatorId)) throw new ForbiddenException('You are no longer friends with the creator.');
    const updated = await this.prisma.irlInvitation.updateMany({ where: { id: invitationId, recipientId: userId, status: 'PENDING' }, data: { status } });
    if (!updated.count) throw new BadRequestException('Invitation already answered.');
    return this.prisma.irlInvitation.findUnique({ where: { id: invitationId } });
  }

}
