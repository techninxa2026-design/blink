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
exports.CheckinsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DURATIONS = {
    '24h': 24 * 60 * 60 * 1000,
    '48h': 48 * 60 * 60 * 1000,
    'until_removed': null,
};
let CheckinsService = class CheckinsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    active() {
        return [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
    }
    async mine(userId) {
        return this.prisma.checkin.findFirst({
            where: { userId, OR: this.active() },
            include: { user: { select: { id: true, name: true, avatarKey: true } } },
        });
    }
    async feed(userId) {
        const friendships = await this.prisma.friendship.findMany({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            select: { userAId: true, userBId: true },
        });
        const friendIds = friendships.map(f => f.userAId === userId ? f.userBId : f.userAId);
        const blocked = await this.prisma.userBlock.findMany({
            where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
            select: { blockerId: true, blockedId: true },
        });
        const blockedIds = new Set(blocked.map(b => b.blockerId === userId ? b.blockedId : b.blockerId));
        const visibleIds = [userId, ...friendIds.filter(id => !blockedIds.has(id))];
        return this.prisma.checkin.findMany({
            where: { userId: { in: visibleIds }, OR: this.active() },
            include: { user: { select: { id: true, name: true, avatarKey: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async create(userId, input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new common_1.BadRequestException('A check-in is required.');
        }
        const body = input;
        if (typeof body.emoji !== 'string' || !body.emoji.trim() || [...body.emoji].length > 8) {
            throw new common_1.BadRequestException('Choose a valid emoji.');
        }
        if (typeof body.status !== 'string' || !body.status.trim() || [...body.status.trim()].length > 80) {
            throw new common_1.BadRequestException('Status must be 1–80 characters.');
        }
        if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
            throw new common_1.BadRequestException('Note must be text.');
        }
        const note = typeof body.note === 'string' ? body.note.trim() : '';
        if ([...note].length > 280) {
            throw new common_1.BadRequestException('Note cannot exceed 280 characters.');
        }
        if (typeof body.duration !== 'string' || !Object.prototype.hasOwnProperty.call(DURATIONS, body.duration)) {
            throw new common_1.BadRequestException('Duration must be 24h, 48h, or until_removed.');
        }
        const now = new Date();
        const durationMs = DURATIONS[body.duration];
        const expiresAt = durationMs === null ? null : new Date(now.getTime() + durationMs);
        const data = { emoji: body.emoji.trim(), status: body.status.trim(), note: note || null, duration: body.duration, expiresAt };
        const current = await this.prisma.checkin.findUnique({ where: { userId } });
        if (current && (!current.expiresAt || current.expiresAt > now)) {
            throw new common_1.ConflictException('Remove your active check-in before creating another.');
        }
        try {
            return await this.prisma.checkin.upsert({
                where: { userId },
                create: { userId, ...data },
                update: { ...data, createdAt: now },
            });
        }
        catch (error) {
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
                throw new common_1.ConflictException('You already have an active check-in.');
            }
            throw error;
        }
    }
    async update(userId, id, input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new common_1.BadRequestException('A Check-In update is required.');
        }
        const body = input;
        if (typeof body.emoji !== 'string' || !body.emoji.trim() || [...body.emoji].length > 8)
            throw new common_1.BadRequestException('Choose a valid emoji.');
        if (typeof body.status !== 'string' || !body.status.trim() || [...body.status.trim()].length > 80)
            throw new common_1.BadRequestException('Status must be 1–80 characters.');
        if (body.note !== undefined && body.note !== null && typeof body.note !== 'string')
            throw new common_1.BadRequestException('Note must be text.');
        const note = typeof body.note === 'string' ? body.note.trim() : '';
        if ([...note].length > 280)
            throw new common_1.BadRequestException('Note cannot exceed 280 characters.');
        if (typeof body.duration !== 'string' || !Object.prototype.hasOwnProperty.call(DURATIONS, body.duration))
            throw new common_1.BadRequestException('Invalid duration.');
        const now = new Date();
        const current = await this.prisma.checkin.findFirst({ where: { id, userId, OR: this.active() } });
        if (!current)
            throw new common_1.NotFoundException('Active Check-In not found.');
        const durationMs = DURATIONS[body.duration];
        const expiresAt = durationMs === null ? null : new Date(now.getTime() + durationMs);
        const updated = await this.prisma.checkin.updateMany({
            where: { id, userId, OR: this.active() },
            data: { emoji: body.emoji.trim(), status: body.status.trim(), note: note || null, duration: body.duration, expiresAt },
        });
        if (!updated.count)
            throw new common_1.NotFoundException('Active Check-In not found.');
        return this.prisma.checkin.findUnique({ where: { id } });
    }
    async remove(userId, id) {
        const result = await this.prisma.checkin.deleteMany({ where: { id, userId } });
        if (!result.count)
            throw new common_1.NotFoundException('Check-in not found.');
        return { message: 'Check-in removed.' };
    }
};
exports.CheckinsService = CheckinsService;
exports.CheckinsService = CheckinsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CheckinsService);
//# sourceMappingURL=checkins.service.js.map