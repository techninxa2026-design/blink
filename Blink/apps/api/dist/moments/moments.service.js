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
exports.MomentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const prisma_service_1 = require("../prisma/prisma.service");
const UPLOAD_DIR = (0, node_path_1.join)(__dirname, '..', '..', 'uploads');
let MomentsService = class MomentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, file, caption) {
        const moment = await this.prisma.moment.create({
            data: {
                senderId: userId,
                type: client_1.MomentType.PUBLIC,
                mediaKey: file.filename,
                caption: caption?.trim() || null,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        return this.formatMoment(moment);
    }
    async findFeed() {
        const moments = await this.prisma.moment.findMany({
            where: {
                type: client_1.MomentType.PUBLIC,
                recipientId: null,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                sender: {
                    select: { id: true, name: true, avatarKey: true },
                },
            },
        });
        return moments.map((moment) => ({
            ...this.formatMoment(moment),
            sender: moment.sender,
        }));
    }
    async findMine(userId) {
        const moments = await this.prisma.moment.findMany({
            where: { senderId: userId },
            orderBy: { createdAt: 'desc' },
        });
        return moments.map((moment) => this.formatMoment(moment));
    }
    async recordView(userId, momentId) {
        const now = new Date();
        const moment = await this.prisma.moment.findFirst({
            where: {
                id: momentId,
                type: client_1.MomentType.PUBLIC,
                recipientId: null,
                senderId: { not: userId },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
            select: {
                id: true,
                expiresAt: true,
            },
        });
        if (!moment) {
            throw new common_1.NotFoundException('Moment not found or has expired.');
        }
        await this.prisma.momentView.upsert({
            where: {
                momentId_viewerId: {
                    momentId,
                    viewerId: userId,
                },
            },
            create: {
                momentId,
                viewerId: userId,
                expiresAt: moment.expiresAt ??
                    new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
            update: {
                viewedAt: now,
                expiresAt: moment.expiresAt ??
                    new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        return { message: 'Moment view recorded.' };
    }
    async getViews(userId, momentId) {
        const moment = await this.prisma.moment.findFirst({
            where: {
                id: momentId,
                senderId: userId,
            },
            select: {
                id: true,
            },
        });
        if (!moment) {
            throw new common_1.NotFoundException('Moment not found or you do not own it.');
        }
        const views = await this.prisma.momentView.findMany({
            where: {
                momentId,
                expiresAt: {
                    gt: new Date(),
                },
            },
            orderBy: {
                viewedAt: 'desc',
            },
            include: {
                viewer: {
                    select: {
                        id: true,
                        name: true,
                        avatarKey: true,
                    },
                },
            },
        });
        return views.map((view) => ({
            viewerId: view.viewer.id,
            name: view.viewer.name,
            avatarKey: view.viewer.avatarKey,
            viewedAt: view.viewedAt,
        }));
    }
    async remove(userId, momentId) {
        const moment = await this.prisma.moment.findFirst({
            where: {
                id: momentId,
                senderId: userId,
            },
        });
        if (!moment) {
            throw new common_1.NotFoundException('Moment not found or you do not own it.');
        }
        await this.prisma.moment.delete({
            where: { id: moment.id },
        });
        try {
            await (0, promises_1.unlink)((0, node_path_1.join)(UPLOAD_DIR, moment.mediaKey));
        }
        catch (error) {
            const code = error.code;
            if (code !== 'ENOENT') {
                console.error('Could not remove uploaded media:', error);
            }
        }
        return { message: 'Moment deleted successfully.' };
    }
    formatMoment(moment) {
        return {
            id: moment.id,
            senderId: moment.senderId,
            mediaUrl: `/uploads/${encodeURIComponent(moment.mediaKey)}`,
            mediaType: /\.(mp4|webm|mov)$/i.test(moment.mediaKey)
                ? 'video'
                : 'photo',
            caption: moment.caption,
            createdAt: moment.createdAt,
        };
    }
};
exports.MomentsService = MomentsService;
exports.MomentsService = MomentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MomentsService);
//# sourceMappingURL=moments.service.js.map