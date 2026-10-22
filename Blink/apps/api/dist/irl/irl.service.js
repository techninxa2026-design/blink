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
        return plans.map(plan => ({ ...plan, invitations: plan.creatorId === userId ? plan.invitations : plan.invitations.filter(inv => inv.recipientId === userId) }));
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
        await this.prisma.irlInterest.deleteMany({ where: { planId: id, userId } });
        return { deleted: true };
    }
    async invitations(userId) {
        return this.prisma.irlInvitation.findMany({
            where: { recipientId: userId },
            include: { plan: { include: { creator: { select: { id: true, name: true } } } } },
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
            create: { planId, recipientId },
            update: {},
        });
    }
    async respondInvitation(userId, invitationId, status) {
        if (status !== 'ACCEPTED' && status !== 'DECLINED')
            throw new common_1.BadRequestException('Choose ACCEPTED or DECLINED.');
        const invitation = await this.prisma.irlInvitation.findUnique({
            where: { id: invitationId }, include: { plan: { select: { startsAt: true, creatorId: true } } },
        });
        if (!invitation)
            throw new common_1.NotFoundException('Invitation not found.');
        if (invitation.recipientId !== userId)
            throw new common_1.ForbiddenException('This invitation is not yours.');
        if (invitation.status !== 'PENDING')
            throw new common_1.BadRequestException('Invitation already answered.');
        if (invitation.plan.startsAt <= new Date())
            throw new common_1.BadRequestException('This plan has already started.');
        const friends = await this.friendIds(userId);
        if (!friends.includes(invitation.plan.creatorId))
            throw new common_1.ForbiddenException('You are no longer friends with the creator.');
        const updated = await this.prisma.irlInvitation.updateMany({ where: { id: invitationId, recipientId: userId, status: 'PENDING' }, data: { status } });
        if (!updated.count)
            throw new common_1.BadRequestException('Invitation already answered.');
        return this.prisma.irlInvitation.findUnique({ where: { id: invitationId } });
    }
};
exports.IrlService = IrlService;
exports.IrlService = IrlService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IrlService);
//# sourceMappingURL=irl.service.js.map