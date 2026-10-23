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
exports.BusinessMatchService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const publicFields = {
    id: true, type: true, name: true, headline: true, industry: true,
    location: true, skills: true, about: true, lookingFor: true,
};
let BusinessMatchService = class BusinessMatchService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mine(userId) {
        return this.prisma.businessProfile.findUnique({ where: { userId } });
    }
    async save(userId, dto) {
        const name = dto.name.trim();
        const headline = dto.headline.trim();
        const industry = dto.industry.trim();
        if (!name || !headline || !industry)
            throw new common_1.BadRequestException('Name, headline and industry are required.');
        const data = {
            type: dto.type, name, headline, industry,
            location: dto.location?.trim() ?? '', skills: dto.skills?.trim() ?? '',
            about: dto.about?.trim() ?? '', lookingFor: dto.lookingFor?.trim() ?? '',
        };
        return this.prisma.businessProfile.upsert({
            where: { userId }, create: { userId, ...data }, update: data,
        });
    }
    async activate(userId, active) {
        const profile = await this.mine(userId);
        if (!profile)
            throw new common_1.NotFoundException('Create a business profile first.');
        if (active && (!profile.name.trim() || !profile.headline.trim() || !profile.industry.trim())) {
            throw new common_1.BadRequestException('Complete name, headline and industry first.');
        }
        return this.prisma.businessProfile.update({ where: { userId }, data: { active } });
    }
    async requireActive(userId) {
        const mine = await this.mine(userId);
        if (!mine?.active)
            throw new common_1.ForbiddenException('Activate your Business Profile to access discovery.');
    }
    async discover(userId, query, type, page = 1) {
        await this.requireActive(userId);
        const search = query.trim();
        const where = {
            active: true, userId: { not: userId },
            ...(type ? { type } : {}),
            ...(search ? { OR: [
                    { name: { contains: search } }, { headline: { contains: search } },
                    { industry: { contains: search } }, { location: { contains: search } },
                    { skills: { contains: search } },
                ] } : {}),
        };
        return this.prisma.businessProfile.findMany({
            where, select: publicFields, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20,
        });
    }
    async publicProfile(userId, profileId) {
        await this.requireActive(userId);
        const profile = await this.prisma.businessProfile.findFirst({
            where: { id: profileId, active: true, userId: { not: userId } },
            select: publicFields,
        });
        if (!profile)
            throw new common_1.NotFoundException('Business profile not found.');
        return profile;
    }
    async requireBothActive(userId, otherId) {
        await this.requireActive(userId);
        if (userId === otherId)
            throw new common_1.BadRequestException('You cannot connect to yourself.');
        const target = await this.prisma.businessProfile.findFirst({ where: { id: otherId, active: true }, select: { userId: true } });
        if (!target)
            throw new common_1.NotFoundException('Active Business Profile not found.');
        return target.userId;
    }
    async sendRequest(userId, profileId) {
        const receiverId = await this.requireBothActive(userId, profileId);
        const existing = await this.prisma.businessConnectionRequest.findFirst({ where: {
                OR: [{ senderId: userId, receiverId }, { senderId: receiverId, receiverId: userId }],
            } });
        if (existing)
            throw new common_1.ConflictException('A business connection request or relationship already exists.');
        try {
            return await this.prisma.businessConnectionRequest.create({ data: { senderId: userId, receiverId }, select: { id: true, status: true, createdAt: true } });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
                throw new common_1.ConflictException('Request already exists.');
            throw error;
        }
    }
    async requests(userId) {
        await this.requireActive(userId);
        const rows = await this.prisma.businessConnectionRequest.findMany({
            where: { status: 'PENDING', OR: [{ senderId: userId }, { receiverId: userId }] },
            orderBy: { createdAt: 'desc' }, take: 100,
            select: { id: true, senderId: true, receiverId: true, status: true, createdAt: true,
                sender: { select: { businessProfile: { select: { ...publicFields, active: true } } } },
                receiver: { select: { businessProfile: { select: { ...publicFields, active: true } } } },
            },
        });
        return rows.filter(r => r.sender.businessProfile?.active && r.receiver.businessProfile?.active)
            .map(r => ({ id: r.id, direction: r.receiverId === userId ? 'incoming' : 'outgoing', status: r.status,
            createdAt: r.createdAt, profile: (() => { const p = r.receiverId === userId ? r.sender.businessProfile : r.receiver.businessProfile; return { id: p.id, type: p.type, name: p.name, headline: p.headline, industry: p.industry, location: p.location, skills: p.skills, about: p.about, lookingFor: p.lookingFor }; })() }));
    }
    async connections(userId) {
        await this.requireActive(userId);
        const rows = await this.prisma.businessConnectionRequest.findMany({
            where: { status: 'ACCEPTED', OR: [{ senderId: userId }, { receiverId: userId }] },
            orderBy: { updatedAt: 'desc' }, take: 100,
            select: { id: true, senderId: true, receiverId: true,
                sender: { select: { businessProfile: { select: { ...publicFields, active: true } } } },
                receiver: { select: { businessProfile: { select: { ...publicFields, active: true } } } },
            },
        });
        return rows.map(r => ({ id: r.id, profile: r.receiverId === userId ? r.sender.businessProfile : r.receiver.businessProfile }))
            .filter(r => r.profile?.active).map(r => ({ id: r.id, profile: {
                id: r.profile.id, type: r.profile.type, name: r.profile.name, headline: r.profile.headline,
                industry: r.profile.industry, location: r.profile.location, skills: r.profile.skills,
                about: r.profile.about, lookingFor: r.profile.lookingFor,
            } }));
    }
    async respond(userId, requestId, accept) {
        await this.requireActive(userId);
        const request = await this.prisma.businessConnectionRequest.findFirst({ where: { id: requestId, receiverId: userId, status: 'PENDING' } });
        if (!request)
            throw new common_1.NotFoundException('Pending incoming request not found.');
        const senderActive = await this.prisma.businessProfile.count({ where: { userId: request.senderId, active: true } });
        if (!senderActive)
            throw new common_1.ForbiddenException('Sender is no longer active.');
        const result = await this.prisma.businessConnectionRequest.updateMany({ where: { id: requestId, receiverId: userId, status: 'PENDING' }, data: { status: accept ? 'ACCEPTED' : 'DECLINED' } });
        if (!result.count)
            throw new common_1.ConflictException('Request was already handled.');
        return { status: accept ? 'ACCEPTED' : 'DECLINED' };
    }
    async cancel(userId, requestId) {
        await this.requireActive(userId);
        const result = await this.prisma.businessConnectionRequest.deleteMany({ where: { id: requestId, senderId: userId, status: 'PENDING' } });
        if (!result.count)
            throw new common_1.NotFoundException('Pending outgoing request not found.');
        return { canceled: true };
    }
    async requireChatAccess(userId, connectionId) {
        const connection = await this.prisma.businessConnectionRequest.findFirst({
            where: { id: connectionId, status: 'ACCEPTED', OR: [{ senderId: userId }, { receiverId: userId }] },
            select: { id: true, senderId: true, receiverId: true },
        });
        if (!connection)
            throw new common_1.NotFoundException('Business conversation not found.');
        const profiles = await this.prisma.businessProfile.findMany({
            where: { userId: { in: [connection.senderId, connection.receiverId] }, active: true },
            select: { userId: true },
        });
        if (profiles.length !== 2)
            throw new common_1.ForbiddenException('Both Business Profiles must be active.');
        return connection;
    }
    async chatMessages(userId, connectionId, before) {
        await this.requireChatAccess(userId, connectionId);
        if (before) {
            const cursor = await this.prisma.businessChatMessage.findFirst({ where: { id: before, connectionId }, select: { id: true } });
            if (!cursor)
                throw new common_1.BadRequestException('Invalid message cursor.');
        }
        const messages = await this.prisma.businessChatMessage.findMany({
            where: { connectionId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 30,
            ...(before ? { skip: 1, cursor: { id: before } } : {}),
            select: { id: true, senderId: true, text: true, createdAt: true },
        });
        return messages.reverse();
    }
    async sendChatMessage(userId, connectionId, rawText) {
        await this.requireChatAccess(userId, connectionId);
        const text = rawText.trim();
        if (!text)
            throw new common_1.BadRequestException('Message cannot be blank.');
        return this.prisma.businessChatMessage.create({
            data: { connectionId, senderId: userId, text },
            select: { id: true, senderId: true, text: true, createdAt: true },
        });
    }
    async ensureMeetingAccess(userId, connectionId) {
        return this.requireChatAccess(userId, connectionId);
    }
    async meetings(userId) {
        await this.requireActive(userId);
        const rows = await this.prisma.businessMeeting.findMany({
            where: { OR: [{ organizerId: userId }, { attendeeId: userId }] },
            orderBy: { startsAt: 'asc' }, take: 200,
            select: { id: true, connectionId: true, organizerId: true, attendeeId: true, title: true,
                agenda: true, location: true, startsAt: true, endsAt: true, status: true, createdAt: true,
                organizer: { select: { businessProfile: { select: { name: true } } } },
                attendee: { select: { businessProfile: { select: { name: true } } } } },
        });
        return rows.map(m => ({ id: m.id, connectionId: m.connectionId, title: m.title, agenda: m.agenda,
            location: m.location, startsAt: m.startsAt, endsAt: m.endsAt, status: m.status, createdAt: m.createdAt,
            role: m.organizerId === userId ? 'organizer' : 'attendee',
            counterpartName: m.organizerId === userId ? m.attendee.businessProfile?.name ?? 'Business user' : m.organizer.businessProfile?.name ?? 'Business user' }));
    }
    async assertNoMeetingConflict(userId, startsAt, endsAt, excludeId) {
        const conflict = await this.prisma.businessMeeting.findFirst({ where: {
                ...(excludeId ? { id: { not: excludeId } } : {}),
                status: 'ACCEPTED', startsAt: { lt: endsAt }, endsAt: { gt: startsAt },
                OR: [{ organizerId: userId }, { attendeeId: userId }],
            }, select: { id: true } });
        if (conflict)
            throw new common_1.ConflictException('A confirmed Business Meeting overlaps this time.');
    }
    async createMeeting(userId, dto) {
        const connection = await this.ensureMeetingAccess(userId, dto.connectionId);
        const startsAt = new Date(dto.startsAt), endsAt = new Date(dto.endsAt);
        if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt <= new Date() || endsAt <= startsAt)
            throw new common_1.BadRequestException('Choose a future start time and an end time after the start.');
        if (endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000)
            throw new common_1.BadRequestException('Meeting duration must not exceed 8 hours.');
        const title = dto.title.trim();
        if (!title)
            throw new common_1.BadRequestException('Meeting title is required.');
        const attendeeId = connection.senderId === userId ? connection.receiverId : connection.senderId;
        await this.assertNoMeetingConflict(userId, startsAt, endsAt);
        await this.assertNoMeetingConflict(attendeeId, startsAt, endsAt);
        return this.prisma.businessMeeting.create({ data: { connectionId: connection.id, organizerId: userId, attendeeId,
                title, agenda: dto.agenda?.trim() ?? '', location: dto.location?.trim() ?? '', startsAt, endsAt },
            select: { id: true, status: true, startsAt: true, endsAt: true } });
    }
    async answerMeeting(userId, id, accept) {
        const meeting = await this.prisma.businessMeeting.findFirst({ where: { id, attendeeId: userId, status: 'PENDING' } });
        if (!meeting)
            throw new common_1.NotFoundException('Pending meeting invitation not found.');
        await this.ensureMeetingAccess(userId, meeting.connectionId);
        if (accept) {
            await this.assertNoMeetingConflict(meeting.organizerId, meeting.startsAt, meeting.endsAt, id);
            await this.assertNoMeetingConflict(userId, meeting.startsAt, meeting.endsAt, id);
        }
        const updated = await this.prisma.businessMeeting.updateMany({ where: { id, attendeeId: userId, status: 'PENDING' },
            data: { status: accept ? 'ACCEPTED' : 'DECLINED' } });
        if (!updated.count)
            throw new common_1.ConflictException('Meeting invitation was already handled.');
        return { status: accept ? 'ACCEPTED' : 'DECLINED' };
    }
    async cancelMeeting(userId, id) {
        const meeting = await this.prisma.businessMeeting.findFirst({ where: { id, organizerId: userId, status: { in: ['PENDING', 'ACCEPTED'] } } });
        if (!meeting)
            throw new common_1.NotFoundException('Cancelable meeting not found.');
        await this.ensureMeetingAccess(userId, meeting.connectionId);
        const result = await this.prisma.businessMeeting.updateMany({ where: { id, organizerId: userId, status: { in: ['PENDING', 'ACCEPTED'] } }, data: { status: 'CANCELED' } });
        if (!result.count)
            throw new common_1.ConflictException('Meeting already changed.');
        return { status: 'CANCELED' };
    }
};
exports.BusinessMatchService = BusinessMatchService;
exports.BusinessMatchService = BusinessMatchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BusinessMatchService);
//# sourceMappingURL=business-match.service.js.map