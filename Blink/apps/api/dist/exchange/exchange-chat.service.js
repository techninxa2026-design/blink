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
exports.ExchangeChatService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ExchangeChatService = class ExchangeChatService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPost(postId) {
        const post = await this.prisma.exchangePost.findUnique({
            where: { id: postId },
            select: {
                id: true,
                authorId: true,
                status: true,
            },
        });
        if (!post) {
            throw new common_1.NotFoundException('Exchange post not found.');
        }
        return post;
    }
    async ensureNotBlocked(ownerId, requesterId) {
        const blocked = await this.prisma.userBlock.findFirst({
            where: {
                OR: [
                    {
                        blockerId: ownerId,
                        blockedId: requesterId,
                    },
                    {
                        blockerId: requesterId,
                        blockedId: ownerId,
                    },
                ],
            },
        });
        if (blocked) {
            throw new common_1.ForbiddenException('Private conversation is unavailable.');
        }
    }
    async getAuthorizedThread(userId, postId, threadId) {
        const thread = await this.prisma.exchangeThread.findFirst({
            where: {
                id: threadId,
                postId,
            },
            include: {
                post: {
                    select: { authorId: true },
                },
            },
        });
        if (!thread) {
            throw new common_1.NotFoundException('Conversation not found.');
        }
        if (userId !== thread.post.authorId &&
            userId !== thread.requesterId) {
            throw new common_1.ForbiddenException('You cannot access this conversation.');
        }
        await this.ensureNotBlocked(thread.post.authorId, thread.requesterId);
        return thread;
    }
    async myThread(userId, postId) {
        const post = await this.getPost(postId);
        if (post.authorId === userId) {
            throw new common_1.BadRequestException('The post owner must select a conversation.');
        }
        await this.ensureNotBlocked(post.authorId, userId);
        const thread = await this.prisma.exchangeThread.findUnique({
            where: {
                postId_requesterId: {
                    postId,
                    requesterId: userId,
                },
            },
            select: { id: true },
        });
        return {
            threadId: thread?.id ?? null,
        };
    }
    async startThread(userId, postId) {
        const post = await this.getPost(postId);
        if (post.authorId === userId) {
            throw new common_1.BadRequestException('You cannot request your own service.');
        }
        await this.ensureNotBlocked(post.authorId, userId);
        const existing = await this.prisma.exchangeThread.findUnique({
            where: {
                postId_requesterId: {
                    postId,
                    requesterId: userId,
                },
            },
            select: { id: true },
        });
        if (existing) {
            return { threadId: existing.id };
        }
        if (post.status === 'CLOSED') {
            throw new common_1.BadRequestException('This exchange is closed to new conversations.');
        }
        const thread = await this.prisma.exchangeThread.upsert({
            where: {
                postId_requesterId: {
                    postId,
                    requesterId: userId,
                },
            },
            create: {
                postId,
                requesterId: userId,
            },
            update: {},
            select: { id: true },
        });
        return { threadId: thread.id };
    }
    async ownerThreads(userId, postId) {
        const post = await this.getPost(postId);
        if (post.authorId !== userId) {
            throw new common_1.ForbiddenException('Only the post owner can see interested users.');
        }
        return this.prisma.exchangeThread.findMany({
            where: { postId },
            include: {
                requester: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                _count: {
                    select: {
                        messages: true,
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
    }
    async messages(userId, postId, threadId) {
        await this.getAuthorizedThread(userId, postId, threadId);
        const messages = await this.prisma.exchangeChatMessage.findMany({
            where: { threadId },
            select: {
                id: true,
                text: true,
                senderId: true,
                createdAt: true,
                sender: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 100,
        });
        return messages.reverse();
    }
    async sendMessage(userId, postId, threadId, value) {
        await this.getAuthorizedThread(userId, postId, threadId);
        const text = typeof value === 'string'
            ? value.trim()
            : '';
        if (text.length < 1 || text.length > 2000) {
            throw new common_1.BadRequestException('Message must be between 1 and 2000 characters.');
        }
        return this.prisma.$transaction(async (tx) => {
            const message = await tx.exchangeChatMessage.create({
                data: {
                    threadId,
                    senderId: userId,
                    text,
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            await tx.exchangeThread.update({
                where: { id: threadId },
                data: {
                    updatedAt: new Date(),
                },
            });
            return message;
        });
    }
};
exports.ExchangeChatService = ExchangeChatService;
exports.ExchangeChatService = ExchangeChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExchangeChatService);
//# sourceMappingURL=exchange-chat.service.js.map