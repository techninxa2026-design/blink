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
exports.ProfileService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const UPLOAD_DIR = (0, node_path_1.join)(__dirname, '..', '..', 'uploads');
let ProfileService = class ProfileService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                avatarKey: true,
                bio: true,
                coverKey: true,
                createdAt: true,
                _count: {
                    select: {
                        sentRequests: {
                            where: { status: 'ACCEPTED' },
                        },
                        receivedRequests: {
                            where: { status: 'ACCEPTED' },
                        },
                    },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('Profile not found.');
        }
        const connections = await this.prisma.friendship.count({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        });
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            avatarKey: user.avatarKey,
            bio: user.bio,
            coverKey: user.coverKey,
            createdAt: user.createdAt,
            followersCount: user._count.receivedRequests,
            followingCount: user._count.sentRequests,
            connectionsCount: connections,
        };
    }
    async updateMyProfile(userId, body) {
        const data = {};
        if (body.name !== undefined) {
            if (typeof body.name !== 'string') {
                throw new common_1.BadRequestException('Name must be text.');
            }
            const name = body.name.trim();
            if (name.length < 2 || name.length > 80) {
                throw new common_1.BadRequestException('Name must be between 2 and 80 characters.');
            }
            data.name = name;
        }
        if (body.bio !== undefined) {
            if (body.bio !== null &&
                typeof body.bio !== 'string') {
                throw new common_1.BadRequestException('Bio must be text.');
            }
            const bio = typeof body.bio === 'string'
                ? body.bio.trim()
                : '';
            if (bio.length > 300) {
                throw new common_1.BadRequestException('Bio cannot exceed 300 characters.');
            }
            data.bio = bio || null;
        }
        if (Object.keys(data).length === 0) {
            throw new common_1.BadRequestException('No profile changes provided.');
        }
        const existingUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        if (!existingUser) {
            throw new common_1.NotFoundException('Profile not found.');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data,
        });
        return this.getMyProfile(userId);
    }
    async updateProfileImage(userId, file, field) {
        let saved = false;
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    avatarKey: true,
                    coverKey: true,
                },
            });
            if (!user) {
                throw new common_1.NotFoundException('Profile not found.');
            }
            const previousKey = user[field];
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    [field]: file.filename,
                },
            });
            saved = true;
            if (previousKey &&
                previousKey !== file.filename &&
                /^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(previousKey) &&
                (0, node_path_1.basename)(previousKey) === previousKey) {
                try {
                    await (0, promises_1.unlink)((0, node_path_1.join)(UPLOAD_DIR, previousKey));
                }
                catch (error) {
                    if (error.code !==
                        'ENOENT') {
                        console.error('Could not remove old profile image:', error);
                    }
                }
            }
            return this.getMyProfile(userId);
        }
        catch (error) {
            if (!saved) {
                try {
                    await (0, promises_1.unlink)(file.path);
                }
                catch (cleanupError) {
                    console.error('Could not clean up failed profile upload:', cleanupError);
                }
            }
            throw error;
        }
    }
    async getPublicProfile(viewerId, userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                bio: true,
                avatarKey: true,
                coverKey: true,
                createdAt: true,
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found.');
        }
        const [userAId, userBId] = [viewerId, userId].sort();
        const [connectionsCount, friendship, outgoing, incoming, moments] = await Promise.all([
            this.prisma.friendship.count({
                where: {
                    OR: [{ userAId: userId }, { userBId: userId }],
                },
            }),
            this.prisma.friendship.findUnique({
                where: {
                    userAId_userBId: { userAId, userBId },
                },
            }),
            this.prisma.friendRequest.findFirst({
                where: {
                    senderId: viewerId,
                    receiverId: userId,
                    status: 'PENDING',
                },
                select: { id: true },
            }),
            this.prisma.friendRequest.findFirst({
                where: {
                    senderId: userId,
                    receiverId: viewerId,
                    status: 'PENDING',
                },
                select: { id: true },
            }),
            this.prisma.moment.findMany({
                where: {
                    senderId: userId,
                    type: 'PUBLIC',
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } },
                    ],
                },
                select: {
                    id: true,
                    mediaKey: true,
                    caption: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 60,
            }),
        ]);
        return {
            ...user,
            connectionsCount,
            relationship: viewerId === userId
                ? 'SELF'
                : friendship
                    ? 'FRIENDS'
                    : outgoing
                        ? 'OUTGOING_PENDING'
                        : incoming
                            ? 'INCOMING_PENDING'
                            : 'NONE',
            incomingRequestId: incoming?.id ?? null,
            moments: moments.map((moment) => ({
                id: moment.id,
                mediaUrl: `/uploads/${encodeURIComponent(moment.mediaKey)}`,
                mediaType: /\.(mp4|webm|mov)$/i.test(moment.mediaKey)
                    ? 'video'
                    : 'photo',
                caption: moment.caption,
                createdAt: moment.createdAt,
            })),
        };
    }
};
exports.ProfileService = ProfileService;
exports.ProfileService = ProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProfileService);
//# sourceMappingURL=profile.service.js.map