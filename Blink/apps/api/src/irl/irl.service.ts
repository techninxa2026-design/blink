import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const categories = ['Hangout', 'Sports', 'Gaming', 'Food', 'Shopping', 'Other'];
function validMapsLink(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new BadRequestException('Enter a Google Maps location link.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new BadRequestException('Enter a valid Google Maps URL.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'google.com', 'maps.google.com', 'www.google.co.uk', 'google.co.uk'].includes(host)) {
    throw new BadRequestException('Only HTTPS Google Maps links are allowed.');
  }
  if ((host === 'goo.gl' && !url.pathname.startsWith('/maps')) || (host.includes('google.') && host !== 'maps.app.goo.gl' && !(url.pathname.startsWith('/maps') || url.pathname.startsWith('/url') || url.searchParams.has('q')))) {
    throw new BadRequestException('Enter a Google Maps location link.');
  }
  return url.toString();
}
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
    return plans.map(plan => {
      const ownInvitations = plan.invitations.filter(inv => inv.recipientId === userId);
      const canSeePin = plan.creatorId === userId || (plan.interests.some(i => i.userId === userId) && friends.includes(plan.creatorId) && ownInvitations.some(inv => inv.status === 'ACCEPTED'));
      const participants = (canSeePin ? plan.interests.filter(i => plan.invitations.some(inv => inv.recipientId === i.userId && inv.status === 'ACCEPTED')).map(i => ({ id: i.userId, name: i.user.name })) : []);
      return { ...plan, participants, meetupLat: canSeePin ? plan.meetupLat : null, meetupLng: canSeePin ? plan.meetupLng : null, meetupUrl: canSeePin ? plan.meetupUrl : null,
        invitations: plan.creatorId === userId ? plan.invitations : ownInvitations };
    });
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
  async updateMeetupLocation(userId: string, planId: string, input: unknown) {
    const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const place = typeof body.place === 'string' ? body.place.trim() : '';
    const meetupUrl = validMapsLink(body.meetupUrl);
    if (!place || place.length > 180) throw new BadRequestException('Enter a location name (1–180 characters).');
    const result = await this.prisma.irlPlan.updateMany({
      where: { id: planId, creatorId: userId, startsAt: { gt: new Date() } },
      data: { place, meetupUrl, meetupLat: null, meetupLng: null },
    });
    if (!result.count) throw new NotFoundException('Your upcoming plan was not found.');
    return { updated: true };
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
    await this.prisma.$transaction([
      this.prisma.irlInvitation.deleteMany({ where: { planId: id, recipientId: userId } }),
      this.prisma.irlInterest.deleteMany({ where: { planId: id, userId } }),
    ]);
    return { deleted: true };
  }
  async removeParticipant(userId: string, planId: string, participantId: string) {
    if (!participantId || participantId === userId) throw new BadRequestException('Choose a valid participant.');
    return this.prisma.$transaction(async tx => {
      const plan = await tx.irlPlan.findUnique({ where: { id: planId }, select: { creatorId: true } });
      if (!plan) throw new NotFoundException('Plan not found.');
      if (plan.creatorId !== userId) throw new ForbiddenException('Only the creator can remove participants.');
      const invitation = await tx.irlInvitation.findUnique({
        where: { planId_recipientId: { planId, recipientId: participantId } }, select: { status: true },
      });
      const interest = await tx.irlInterest.findUnique({
        where: { planId_userId: { planId, userId: participantId } }, select: { id: true },
      });
      if (invitation?.status !== 'ACCEPTED' || !interest) throw new BadRequestException('This user is not an active participant.');
      const messages = await tx.irlMessage.deleteMany({ where: { planId, senderId: participantId } });
      await tx.irlInvitation.deleteMany({ where: { planId, recipientId: participantId } });
      await tx.irlInterest.deleteMany({ where: { planId, userId: participantId } });
      return { removed: true, deletedMessages: messages.count };
    });
  }

  async invitations(userId: string) {
    return this.prisma.irlInvitation.findMany({
      where: { recipientId: userId, status: 'ACCEPTED', plan: { interests: { some: { userId } } } },
      include: { plan: { select: { id: true, title: true, startsAt: true, place: true, creator: { select: { id: true, name: true } } } } },
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
      create: { planId, recipientId, status: 'ACCEPTED' },
      update: { status: 'ACCEPTED' },
    });
  }

  private async requireInboxAccess(userId: string, planId: string) {
    const plan = await this.prisma.irlPlan.findUnique({
      where: { id: planId },
      select: { id: true, creatorId: true, title: true, place: true, startsAt: true, meetupLat: true, meetupLng: true, meetupUrl: true },
    });
    if (!plan) throw new NotFoundException('Plan not found.');
    if (plan.creatorId !== userId) {
      const invitation = await this.prisma.irlInvitation.findUnique({
        where: { planId_recipientId: { planId, recipientId: userId } },
        select: { status: true },
      });
      const interest = await this.prisma.irlInterest.findUnique({
        where: { planId_userId: { planId, userId } }, select: { id: true },
      });
      if (invitation?.status !== 'ACCEPTED' || !interest) {
        throw new ForbiddenException('Only the creator and accepted invitees can access this IRL inbox.');
      }
      const friends = await this.friendIds(userId);
      if (!friends.includes(plan.creatorId)) {
        throw new ForbiddenException('You are no longer friends with the creator.');
      }
    }
    return plan;
  }

  async inboxMessages(userId: string, planId: string) {
    const plan = await this.requireInboxAccess(userId, planId);
    const messages = await this.prisma.irlMessage.findMany({
      where: { planId },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
    });
    return { plan, messages };
  }

  async sendInboxMessage(userId: string, planId: string, input: unknown) {
    await this.requireInboxAccess(userId, planId);
    const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 2000) {
      throw new BadRequestException('Message must be 1–2000 characters.');
    }
    return this.prisma.irlMessage.create({
      data: { planId, senderId: userId, text },
      include: { sender: { select: { id: true, name: true } } },
    });
  }

}
