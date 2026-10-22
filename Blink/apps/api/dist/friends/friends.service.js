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
exports.FriendsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const publicUserSelect = {
    id: true,
    name: true,
    avatarKey: true,
    bio: true,
};
let FriendsService = class FriendsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getPair(userId1, userId2) {
        return [userId1, userId2].sort();
    }
    async areFriends(userId1, userId2) {
        const [userAId, userBId] = this.getPair(userId1, userId2);
        return this.prisma.friendship.findUnique({
            where: {
                userAId_userBId: { userAId, userBId },
            },
        });
    }
    async sendRequest(senderId, receiverId) {
        if (!receiverId || typeof receiverId !== 'string') {
            throw new common_1.BadRequestException('A valid receiverId is required.');
        }
        if (senderId === receiverId) {
            throw new common_1.BadRequestException('You cannot send a friend request to yourself.');
        }
        const receiver = await this.prisma.user.findUnique({
            where: { id: receiverId },
            select: { id: true },
        });
        if (!receiver) {
            throw new common_1.NotFoundException('User not found.');
        }
        if (await this.areFriends(senderId, receiverId)) {
            throw new common_1.ConflictException('You are already friends.');
        }
        const existingRequests = await this.prisma.friendRequest.findMany({
            where: {
                OR: [
                    { senderId, receiverId },
                    { senderId: receiverId, receiverId: senderId },
                ],
            },
        });
        if (existingRequests.some((request) => request.status === client_1.FriendRequestStatus.ACCEPTED)) {
            throw new common_1.ConflictException('This connection has already been accepted.');
        }
        if (existingRequests.some((request) => request.status === client_1.FriendRequestStatus.PENDING)) {
            throw new common_1.ConflictException('A friend request is already pending between you.');
        }
        try {
            const previous = existingRequests.find((request) => request.senderId === senderId &&
                request.receiverId === receiverId);
            if (previous) {
                return await this.prisma.friendRequest.update({
                    where: { id: previous.id },
                    data: { status: client_1.FriendRequestStatus.PENDING },
                    include: {
                        receiver: { select: publicUserSelect },
                    },
                });
            }
            return await this.prisma.friendRequest.create({
                data: {
                    senderId,
                    receiverId,
                    status: client_1.FriendRequestStatus.PENDING,
                },
                include: {
                    receiver: { select: publicUserSelect },
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('A friend request already exists.');
            }
            throw error;
        }
    }
    async getIncoming(userId) {
        return this.prisma.friendRequest.findMany({
            where: {
                receiverId: userId,
                status: client_1.FriendRequestStatus.PENDING,
            },
            include: {
                sender: { select: publicUserSelect },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getOutgoing(userId) {
        return this.prisma.friendRequest.findMany({
            where: {
                senderId: userId,
                status: client_1.FriendRequestStatus.PENDING,
            },
            include: {
                receiver: { select: publicUserSelect },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async acceptRequest(userId, requestId) {
        const request = await this.prisma.friendRequest.findUnique({
            where: { id: requestId },
        });
        if (!request || request.receiverId !== userId) {
            throw new common_1.NotFoundException('Friend request not found.');
        }
        if (request.status !== client_1.FriendRequestStatus.PENDING) {
            throw new common_1.ConflictException('This friend request is no longer pending.');
        }
        const [userAId, userBId] = this.getPair(request.senderId, request.receiverId);
        try {
            await this.prisma.$transaction(async (tx) => {
                const updated = await tx.friendRequest.updateMany({
                    where: {
                        id: requestId,
                        receiverId: userId,
                        status: client_1.FriendRequestStatus.PENDING,
                    },
                    data: { status: client_1.FriendRequestStatus.ACCEPTED },
                });
                if (updated.count !== 1) {
                    throw new common_1.ConflictException('This friend request is no longer pending.');
                }
                await tx.friendship.upsert({
                    where: {
                        userAId_userBId: { userAId, userBId },
                    },
                    create: { userAId, userBId },
                    update: {},
                });
                await tx.friendRequest.updateMany({
                    where: {
                        senderId: userId,
                        receiverId: request.senderId,
                        status: client_1.FriendRequestStatus.PENDING,
                    },
                    data: { status: client_1.FriendRequestStatus.ACCEPTED },
                });
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                (error.code === 'P2002' || error.code === 'P2034')) {
                throw new common_1.ConflictException('This request was updated concurrently. Please try again.');
            }
            throw error;
        }
        return {
            message: 'Friend request accepted.',
            friendId: request.senderId,
        };
    }
    async declineRequest(userId, requestId) {
        const updated = await this.prisma.friendRequest.updateMany({
            where: {
                id: requestId,
                receiverId: userId,
                status: client_1.FriendRequestStatus.PENDING,
            },
            data: { status: client_1.FriendRequestStatus.REJECTED },
        });
        if (updated.count !== 1) {
            throw new common_1.NotFoundException('Pending friend request not found.');
        }
        return { message: 'Friend request declined.' };
    }
    async unfriend(userId, friendId) {
        if (userId === friendId) {
            throw new common_1.BadRequestException('You cannot unfriend yourself.');
        }
        const [userAId, userBId] = [userId, friendId].sort();
        const result = await this.prisma.$transaction(async (tx) => {
            const deleted = await tx.friendship.deleteMany({
                where: {
                    userAId,
                    userBId,
                },
            });
            if (deleted.count === 0) {
                throw new common_1.NotFoundException('Friendship not found.');
            }
            await tx.friendRequest.deleteMany({
                where: {
                    status: 'ACCEPTED',
                    OR: [
                        { senderId: userId, receiverId: friendId },
                        { senderId: friendId, receiverId: userId },
                    ],
                },
            });
            return { message: 'You are no longer friends.' };
        });
        return result;
    }
    async searchUsers(userId, query) {
        const search = typeof query === 'string' ? query.trim() : '';
        if (search.length > 80) {
            throw new common_1.BadRequestException('Search cannot exceed 80 characters.');
        }
        if (!search)
            return [];
        return this.prisma.user.findMany({
            where: {
                id: { not: userId },
                name: { contains: search },
            },
            select: publicUserSelect,
            orderBy: { name: 'asc' },
            take: 20,
        });
    }
    async getFriends(userId) {
        const friendships = await this.prisma.friendship.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            include: {
                userA: { select: publicUserSelect },
                userB: { select: publicUserSelect },
            },
            orderBy: { createdAt: 'desc' },
        });
        return friendships.map((friendship) => ({
            friendshipId: friendship.id,
            createdAt: friendship.createdAt,
            user: friendship.userAId === userId
                ? friendship.userB
                : friendship.userA,
        }));
    }
};
exports.FriendsService = FriendsService;
exports.FriendsService = FriendsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FriendsService);
//# sourceMappingURL=friends.service.js.map