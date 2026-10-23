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
exports.HeartsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const heartInclude = {
    sender: {
        select: {
            id: true,
            name: true,
            avatarKey: true,
        },
    },
    receiver: {
        select: {
            id: true,
            name: true,
            avatarKey: true,
        },
    },
    messages: {
        select: {
            id: true,
            authorId: true,
            text: true,
            createdAt: true,
            editedAt: true,
        },
        orderBy: {
            createdAt: 'asc',
        },
        take: 300,
    },
};
let HeartsService = class HeartsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async checkNotBlocked(userA, userB, tx = this.prisma) {
        const block = await tx.userBlock.findFirst({
            where: {
                OR: [
                    {
                        blockerId: userA,
                        blockedId: userB,
                    },
                    {
                        blockerId: userB,
                        blockedId: userA,
                    },
                ],
            },
            select: {
                blockerId: true,
            },
        });
        if (block) {
            throw new common_1.ForbiddenException('This conversation is unavailable.');
        }
    }
    project(thread, viewerId, blockedByMe = false) {
        const incoming = thread.receiverId === viewerId;
        const person = incoming
            ? (thread.senderRevealed
                ? thread.sender
                : null)
            : thread.receiver;
        return {
            id: thread.id,
            side: incoming ? 'incoming' : 'sent',
            status: !incoming &&
                thread.status === 'DECLINED'
                ? 'PENDING'
                : thread.status,
            revealed: thread.senderRevealed,
            person,
            blockedByMe: incoming
                ? blockedByMe
                : false,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            messages: thread.messages.map(message => ({
                id: message.id,
                text: message.text,
                createdAt: message.createdAt,
                editedAt: message.editedAt,
                fromMe: message.authorId === viewerId,
            })),
        };
    }
    async load(userId, threadId) {
        const thread = await this.prisma.blinkHeartThread.findFirst({
            where: {
                id: threadId,
                OR: [
                    { senderId: userId },
                    { receiverId: userId },
                ],
            },
            include: heartInclude,
        });
        if (!thread) {
            throw new common_1.NotFoundException('Heart conversation not found.');
        }
        return thread;
    }
    async people(userId, search) {
        const term = search.trim().slice(0, 80);
        if (term.length < 2) {
            return [];
        }
        const matches = await this.prisma.user.findMany({
            where: {
                id: { not: userId },
                name: { contains: term },
            },
            select: {
                id: true,
                name: true,
                avatarKey: true,
            },
            orderBy: {
                name: 'asc',
            },
            take: 15,
        });
        const blocks = await this.prisma.userBlock.findMany({
            where: {
                OR: [
                    { blockerId: userId },
                    { blockedId: userId },
                ],
            },
            select: {
                blockerId: true,
                blockedId: true,
            },
        });
        const blockedIds = new Set(blocks.map(block => block.blockerId === userId
            ? block.blockedId
            : block.blockerId));
        return matches.filter(user => !blockedIds.has(user.id));
    }
    async list(userId, side) {
        const incoming = side === 'incoming';
        const [threads, blocks] = await Promise.all([
            this.prisma.blinkHeartThread.findMany({
                where: incoming
                    ? { receiverId: userId }
                    : { senderId: userId },
                include: heartInclude,
                orderBy: {
                    updatedAt: 'desc',
                },
                take: 100,
            }),
            incoming
                ? this.prisma.userBlock.findMany({
                    where: {
                        blockerId: userId,
                    },
                    select: {
                        blockedId: true,
                    },
                })
                : Promise.resolve([]),
        ]);
        const blocked = new Set(blocks.map(block => block.blockedId));
        return threads.map(thread => this.project(thread, userId, blocked.has(thread.senderId)));
    }
    async detail(userId, id) {
        const thread = await this.load(userId, id);
        const block = thread.receiverId === userId
            ? await this.prisma.userBlock.findUnique({
                where: {
                    blockerId_blockedId: {
                        blockerId: userId,
                        blockedId: thread.senderId,
                    },
                },
            })
            : null;
        return this.project(thread, userId, Boolean(block));
    }
    async send(senderId, receiverId, input) {
        if (receiverId === senderId) {
            throw new common_1.BadRequestException('You cannot Heart yourself.');
        }
        const text = input.trim();
        if (!text || text.length > 2000) {
            throw new common_1.BadRequestException('Enter a message (1-2000 characters).');
        }
        const receiver = await this.prisma.user.findUnique({
            where: { id: receiverId },
            select: { id: true },
        });
        if (!receiver) {
            throw new common_1.NotFoundException('User not found.');
        }
        await this.prisma.$transaction(async (tx) => {
            await this.checkNotBlocked(senderId, receiverId, tx);
            const thread = await tx.blinkHeartThread.upsert({
                where: {
                    senderId_receiverId: {
                        senderId,
                        receiverId,
                    },
                },
                create: {
                    senderId,
                    receiverId,
                },
                update: {},
            });
            const recent = await tx.blinkHeartMessage.findFirst({
                where: {
                    threadId: thread.id,
                    authorId: senderId,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    createdAt: true,
                },
            });
            if (recent &&
                Date.now() - recent.createdAt.getTime() < 2000) {
                throw new common_1.BadRequestException('Please wait a moment before sending again.');
            }
            if (thread.status === 'DECLINED') {
                await tx.blinkHeartThread.update({
                    where: {
                        id: thread.id,
                    },
                    data: {
                        status: 'PENDING',
                    },
                });
            }
            await tx.blinkHeartMessage.create({
                data: {
                    threadId: thread.id,
                    authorId: senderId,
                    text,
                },
            });
            await tx.blinkHeartThread.update({
                where: {
                    id: thread.id,
                },
                data: {
                    updatedAt: new Date(),
                },
            });
        });
        const thread = await this.prisma.blinkHeartThread
            .findUniqueOrThrow({
            where: {
                senderId_receiverId: {
                    senderId,
                    receiverId,
                },
            },
            include: heartInclude,
        });
        return this.project(thread, senderId);
    }
    async message(userId, id, input) {
        const text = input.trim();
        if (!text || text.length > 2000) {
            throw new common_1.BadRequestException('Enter a message (1-2000 characters).');
        }
        await this.prisma.$transaction(async (tx) => {
            const thread = await tx.blinkHeartThread.findFirst({
                where: {
                    id,
                    OR: [
                        { senderId: userId },
                        { receiverId: userId },
                    ],
                },
                select: {
                    id: true,
                    senderId: true,
                    receiverId: true,
                    status: true,
                },
            });
            if (!thread) {
                throw new common_1.NotFoundException('Heart conversation not found.');
            }
            await this.checkNotBlocked(thread.senderId, thread.receiverId, tx);
            if (userId === thread.receiverId &&
                thread.status !== 'ACCEPTED') {
                throw new common_1.ForbiddenException('Accept the Heart before replying.');
            }
            const recent = await tx.blinkHeartMessage.findFirst({
                where: {
                    threadId: id,
                    authorId: userId,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    createdAt: true,
                },
            });
            if (recent &&
                Date.now() - recent.createdAt.getTime() < 2000) {
                throw new common_1.BadRequestException('Please wait a moment before sending again.');
            }
            if (userId === thread.senderId &&
                thread.status === 'DECLINED') {
                await tx.blinkHeartThread.update({
                    where: { id },
                    data: { status: 'PENDING' },
                });
            }
            await tx.blinkHeartMessage.create({
                data: {
                    threadId: id,
                    authorId: userId,
                    text,
                },
            });
            await tx.blinkHeartThread.update({
                where: { id },
                data: {
                    updatedAt: new Date(),
                },
            });
        });
        return this.detail(userId, id);
    }
    async editMessage(userId, id, messageId, input) {
        if (typeof input !== 'string') {
            throw new common_1.BadRequestException('Message text is required.');
        }
        const text = input.trim();
        if (!text || text.length > 2000) {
            throw new common_1.BadRequestException('Enter a message (1-2000 characters).');
        }
        await this.prisma.$transaction(async (tx) => {
            const thread = await tx.blinkHeartThread.findFirst({
                where: {
                    id,
                    OR: [
                        { senderId: userId },
                        { receiverId: userId },
                    ],
                },
                select: {
                    senderId: true,
                    receiverId: true,
                    status: true,
                },
            });
            if (!thread) {
                throw new common_1.NotFoundException('Heart conversation not found.');
            }
            await this.checkNotBlocked(thread.senderId, thread.receiverId, tx);
            if (userId === thread.receiverId &&
                thread.status !== 'ACCEPTED') {
                throw new common_1.ForbiddenException('Accept the Heart before editing a reply.');
            }
            const result = await tx.blinkHeartMessage.updateMany({
                where: {
                    id: messageId,
                    threadId: id,
                    authorId: userId,
                },
                data: {
                    text,
                    editedAt: new Date(),
                },
            });
            if (result.count === 0) {
                throw new common_1.NotFoundException('Your Heart message was not found.');
            }
            await tx.blinkHeartThread.update({
                where: { id },
                data: {
                    updatedAt: new Date(),
                },
            });
        });
        return this.detail(userId, id);
    }
    async respond(receiverId, id, status) {
        const thread = await this.prisma.blinkHeartThread.findFirst({
            where: {
                id,
                receiverId,
            },
            select: {
                senderId: true,
                status: true,
            },
        });
        if (!thread) {
            throw new common_1.NotFoundException('Heart conversation not found.');
        }
        await this.checkNotBlocked(thread.senderId, receiverId);
        if (thread.status !== 'PENDING') {
            throw new common_1.BadRequestException('This request was already answered.');
        }
        const result = await this.prisma.blinkHeartThread.updateMany({
            where: {
                id,
                receiverId,
                status: 'PENDING',
            },
            data: {
                status,
            },
        });
        if (!result.count) {
            throw new common_1.BadRequestException('The request changed; refresh this page.');
        }
        return this.detail(receiverId, id);
    }
    async reveal(senderId, id) {
        const thread = await this.prisma.blinkHeartThread.findFirst({
            where: {
                id,
                senderId,
            },
            select: {
                receiverId: true,
                status: true,
            },
        });
        if (!thread) {
            throw new common_1.NotFoundException('Heart conversation not found.');
        }
        await this.checkNotBlocked(senderId, thread.receiverId);
        if (thread.status !== 'ACCEPTED') {
            throw new common_1.ForbiddenException('You can only reveal yourself after the recipient accepts.');
        }
        await this.prisma.blinkHeartThread.update({
            where: { id },
            data: {
                senderRevealed: true,
            },
        });
        return this.detail(senderId, id);
    }
    async block(receiverId, id) {
        const thread = await this.prisma.blinkHeartThread.findFirst({
            where: {
                id,
                receiverId,
            },
            select: {
                senderId: true,
            },
        });
        if (!thread) {
            throw new common_1.NotFoundException('Heart conversation not found.');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.userBlock.upsert({
                where: {
                    blockerId_blockedId: {
                        blockerId: receiverId,
                        blockedId: thread.senderId,
                    },
                },
                create: {
                    blockerId: receiverId,
                    blockedId: thread.senderId,
                },
                update: {},
            });
            await tx.blinkHeartThread.updateMany({
                where: {
                    id,
                    status: 'PENDING',
                },
                data: {
                    status: 'DECLINED',
                },
            });
        });
        return {
            blocked: true,
        };
    }
};
exports.HeartsService = HeartsService;
exports.HeartsService = HeartsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HeartsService);
//# sourceMappingURL=hearts.service.js.map