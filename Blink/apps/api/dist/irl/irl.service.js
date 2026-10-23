"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IrlService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const categories = ['Hangout', 'Sports', 'Gaming', 'Food', 'Shopping', 'Other'];
function validMapsLink(value) {
    if (typeof value !== 'string' || value.length > 2048)
        throw new common_1.BadRequestException('Enter a Google Maps location link.');
    let url;
    try {
        url = new URL(value.trim());
    }
    catch {
        throw new common_1.BadRequestException('Enter a valid Google Maps URL.');
    }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'google.com', 'maps.google.com', 'www.google.co.uk', 'google.co.uk'].includes(host)) {
        throw new common_1.BadRequestException('Only HTTPS Google Maps links are allowed.');
    }
    if ((host === 'goo.gl' && !url.pathname.startsWith('/maps')) || (host.includes('google.') && host !== 'maps.app.goo.gl' && !(url.pathname.startsWith('/maps') || url.pathname.startsWith('/url') || url.searchParams.has('q')))) {
        throw new common_1.BadRequestException('Enter a Google Maps location link.');
    }
    return url.toString();
}
let IrlService = class IrlService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async friendIds(userId) {
        const rows = await this.prisma.friendship.findMany({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            select: { userAId: true, userBId: true },
        });
        return rows.map(r => r.userAId === userId ? r.userBId : r.userAId);
    }
    async list(userId) {
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
    async create(userId, input) {
        const body = (input && typeof input === 'object' ? input : {});
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const category = typeof body.category === 'string' ? body.category : '';
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        const place = typeof body.place === 'string' ? body.place.trim() : '';
        const startsAt = typeof body.startsAt === 'string' ? new Date(body.startsAt) : new Date(NaN);
        if (!title || title.length > 120)
            throw new common_1.BadRequestException('Title must be 1–120 characters.');
        if (!categories.includes(category))
            throw new common_1.BadRequestException('Invalid category.');
        if (description.length > 1000 || place.length > 180)
            throw new common_1.BadRequestException('Description or place is too long.');
        if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now())
            throw new common_1.BadRequestException('Choose a future date and time.');
        return this.prisma.irlPlan.create({ data: { creatorId: userId, title, category, description: description || null, place: place || null, startsAt } });
    }
    async updateMeetupLocation(userId, planId, input) {
        const body = (input && typeof input === 'object' ? input : {});
        const place = typeof body.place === 'string' ? body.place.trim() : '';
        const meetupUrl = validMapsLink(body.meetupUrl);
        if (!place || place.length > 180)
            throw new common_1.BadRequestException('Enter a location name (1–180 characters).');
        const result = await this.prisma.irlPlan.updateMany({
            where: { id: planId, creatorId: userId, startsAt: { gt: new Date() } },
            data: { place, meetupUrl, meetupLat: null, meetupLng: null },
        });
        if (!result.count)
            throw new common_1.NotFoundException('Your upcoming plan was not found.');
        return { updated: true };
    }
    async remove(userId, id) {
        const result = await this.prisma.irlPlan.deleteMany({ where: { id, creatorId: userId } });
        if (!result.count)
            throw new common_1.NotFoundException('Your plan was not found.');
        return { deleted: true };
    }
    async interest(userId, id, input) {
        const plan = await this.prisma.irlPlan.findUnique({ where: { id }, select: { creatorId: true, startsAt: true } });
        if (!plan)
            throw new common_1.NotFoundException('Plan not found.');
        if (plan.creatorId === userId)
            throw new common_1.ForbiddenException('You cannot respond to your own plan.');
        if (plan.startsAt.getTime() <= Date.now())
            throw new common_1.BadRequestException('This plan has already started.');
        const friends = await this.friendIds(userId);
        if (!friends.includes(plan.creatorId))
            throw new common_1.ForbiddenException('Only friends can respond.');
        const body = (input && typeof input === 'object' ? input : {});
        const reply = typeof body.reply === 'string' ? body.reply.trim() : '';
        if (reply.length > 500)
            throw new common_1.BadRequestException('Reply must be 500 characters or fewer.');
        return this.prisma.irlInterest.upsert({
            where: { planId_userId: { planId: id, userId } },
            create: { planId: id, userId, reply },
            update: { reply },
        });
    }
    async withdraw(userId, id) {
        await this.prisma.$transaction([
            this.prisma.irlInvitation.deleteMany({ where: { planId: id, recipientId: userId } }),
            this.prisma.irlInterest.deleteMany({ where: { planId: id, userId } }),
        ]);
        return { deleted: true };
    }
    async removeParticipant(userId, planId, participantId) {
        if (!participantId || participantId === userId)
            throw new common_1.BadRequestException('Choose a valid participant.');
        return this.prisma.$transaction(async (tx) => {
            const plan = await tx.irlPlan.findUnique({ where: { id: planId }, select: { creatorId: true } });
            if (!plan)
                throw new common_1.NotFoundException('Plan not found.');
            if (plan.creatorId !== userId)
                throw new common_1.ForbiddenException('Only the creator can remove participants.');
            const invitation = await tx.irlInvitation.findUnique({
                where: { planId_recipientId: { planId, recipientId: participantId } }, select: { status: true },
            });
            const interest = await tx.irlInterest.findUnique({
                where: { planId_userId: { planId, userId: participantId } }, select: { id: true },
            });
            if (invitation?.status !== 'ACCEPTED' || !interest)
                throw new common_1.BadRequestException('This user is not an active participant.');
            const messages = await tx.irlMessage.deleteMany({ where: { planId, senderId: participantId } });
            await tx.irlInvitation.deleteMany({ where: { planId, recipientId: participantId } });
            await tx.irlInterest.deleteMany({ where: { planId, userId: participantId } });
            return { removed: true, deletedMessages: messages.count };
        });
    }
    async invitations(userId) {
        return this.prisma.irlInvitation.findMany({
            where: { recipientId: userId, status: 'ACCEPTED', plan: { interests: { some: { userId } } } },
            include: { plan: { select: { id: true, title: true, startsAt: true, place: true, creator: { select: { id: true, name: true } } } } },
            orderBy: { createdAt: 'desc' }, take: 100,
        });
    }
    async invite(userId, planId, recipientId) {
        if (!recipientId)
            throw new common_1.BadRequestException('Select an interested friend.');
        const plan = await this.prisma.irlPlan.findUnique({ where: { id: planId }, select: { creatorId: true, startsAt: true } });
        if (!plan)
            throw new common_1.NotFoundException('Plan not found.');
        if (plan.creatorId !== userId)
            throw new common_1.ForbiddenException('Only the plan creator can invite friends.');
        if (plan.startsAt <= new Date())
            throw new common_1.BadRequestException('Cannot invite to a plan that has started.');
        const interested = await this.prisma.irlInterest.findUnique({ where: { planId_userId: { planId, userId: recipientId } } });
        if (!interested)
            throw new common_1.BadRequestException('This friend has not expressed interest.');
        const friends = await this.friendIds(userId);
        if (!friends.includes(recipientId))
            throw new common_1.ForbiddenException('You can only invite your friends.');
        return this.prisma.irlInvitation.upsert({
            where: { planId_recipientId: { planId, recipientId } },
            create: { planId, recipientId, status: 'ACCEPTED' },
            update: { status: 'ACCEPTED' },
        });
    }
    async requireInboxAccess(userId, planId) {
        const plan = await this.prisma.irlPlan.findUnique({
            where: { id: planId },
            select: { id: true, creatorId: true, title: true, place: true, startsAt: true, meetupLat: true, meetupLng: true, meetupUrl: true },
        });
        if (!plan)
            throw new common_1.NotFoundException('Plan not found.');
        if (plan.creatorId !== userId) {
            const invitation = await this.prisma.irlInvitation.findUnique({
                where: { planId_recipientId: { planId, recipientId: userId } },
                select: { status: true },
            });
            const interest = await this.prisma.irlInterest.findUnique({
                where: { planId_userId: { planId, userId } }, select: { id: true },
            });
            if (invitation?.status !== 'ACCEPTED' || !interest) {
                throw new common_1.ForbiddenException('Only the creator and accepted invitees can access this IRL inbox.');
            }
            const friends = await this.friendIds(userId);
            if (!friends.includes(plan.creatorId)) {
                throw new common_1.ForbiddenException('You are no longer friends with the creator.');
            }
        }
        return plan;
    }
    async inboxMessages(userId, planId) {
        const plan = await this.requireInboxAccess(userId, planId);
        const messages = await this.prisma.irlMessage.findMany({
            where: { planId },
            include: { sender: { select: { id: true, name: true } } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 200,
        });
        return { plan, messages };
    }
    async sendInboxMessage(userId, planId, input) {
        await this.requireInboxAccess(userId, planId);
        const body = (input && typeof input === 'object' ? input : {});
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!text || text.length > 2000) {
            throw new common_1.BadRequestException('Message must be 1–2000 characters.');
        }
        return this.prisma.irlMessage.create({
            data: { planId, senderId: userId, text },
            include: { sender: { select: { id: true, name: true } } },
        });
    }
};
exports.IrlService = IrlService;
exports.IrlService = IrlService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IrlService);
//# sourceMappingURL=irl.service.js.map