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
exports.SecretsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const CORRECT_GUESS_BP = 10;
const PAGE_SIZE = 80;
let SecretsService = class SecretsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async friendIds(userId) {
        const rows = await this.prisma.friendship.findMany({
            where: {
                OR: [
                    { userAId: userId },
                    { userBId: userId },
                ],
            },
            select: {
                userAId: true,
                userBId: true,
            },
        });
        return rows.map(f => f.userAId === userId ? f.userBId : f.userAId);
    }
    async canSee(userId, creatorId) {
        if (userId === creatorId)
            return true;
        return (await this.prisma.friendship.count({
            where: {
                OR: [
                    { userAId: userId, userBId: creatorId },
                    { userAId: creatorId, userBId: userId },
                ],
            },
        })) > 0;
    }
    validateFields(data) {
        const prompt = data.prompt.trim();
        const options = data.options.map(value => value.trim());
        if (prompt.length < 5 ||
            prompt.length > 500) {
            throw new common_1.BadRequestException('Question must be 5-500 characters.');
        }
        if (options.length < 2 ||
            options.length > 5 ||
            options.some(o => !o || o.length > 120)) {
            throw new common_1.BadRequestException('Provide 2-5 nonempty options, max 120 characters each.');
        }
        if (new Set(options.map(o => o.toLowerCase())).size !== options.length) {
            throw new common_1.BadRequestException('Answer options must be different.');
        }
        if (!Number.isInteger(data.correctIndex) ||
            data.correctIndex < 0 ||
            data.correctIndex >= options.length) {
            throw new common_1.BadRequestException('Choose the correct option.');
        }
        if (data.visibility !== 'ANONYMOUS' &&
            data.visibility !== 'NAMED') {
            throw new common_1.BadRequestException('Invalid identity setting.');
        }
        return {
            prompt,
            options,
            correctIndex: data.correctIndex,
            visibility: data.visibility,
        };
    }
    validateRevealTime(value) {
        const revealAt = new Date(value);
        const delay = revealAt.getTime() - Date.now();
        if (!Number.isFinite(delay) ||
            delay < 59 * 60 * 1000 ||
            delay > 7 * 24 * 60 * 60 * 1000) {
            throw new common_1.BadRequestException('Choose a reveal time between 1 hour and 7 days from now.');
        }
        return revealAt;
    }
    async settle(userId) {
        const guesses = await this.prisma.blinkSecretGuess.findMany({
            where: {
                userId,
                secret: {
                    revealAt: {
                        lte: new Date(),
                    },
                    rewards: {
                        none: { userId },
                    },
                },
            },
            include: {
                secret: {
                    select: { correctIndex: true },
                },
            },
            take: 1000,
        });
        for (const guess of guesses) {
            if (guess.selectedIndex !==
                guess.secret.correctIndex) {
                continue;
            }
            try {
                await this.prisma.$transaction(async (tx) => {
                    await tx.blinkSecretReward.create({
                        data: {
                            secretId: guess.secretId,
                            userId,
                            points: CORRECT_GUESS_BP,
                        },
                    });
                    await tx.user.update({
                        where: { id: userId },
                        data: {
                            blinkPoints: {
                                increment: CORRECT_GUESS_BP,
                            },
                        },
                    });
                });
            }
            catch (error) {
                if (error instanceof
                    client_1.Prisma.PrismaClientKnownRequestError &&
                    error.code === 'P2002') {
                    continue;
                }
                throw error;
            }
        }
    }
    async points(userId) {
        await this.settle(userId);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { blinkPoints: true },
        });
        return {
            points: user?.blinkPoints ?? 0,
            correctGuessReward: CORRECT_GUESS_BP,
        };
    }
    async create(userId, data) {
        const fields = this.validateFields(data);
        const revealAt = this.validateRevealTime(data.revealAt);
        const secret = await this.prisma.blinkSecret.create({
            data: {
                ...fields,
                creatorId: userId,
                revealAt,
            },
        });
        return {
            id: secret.id,
            created: true,
        };
    }
    async list(userId) {
        await this.settle(userId);
        const friends = await this.friendIds(userId);
        const items = await this.prisma.blinkSecret.findMany({
            where: {
                creatorId: {
                    in: [userId, ...friends],
                },
            },
            include: {
                creator: {
                    select: {
                        id: true,
                        name: true,
                        avatarKey: true,
                    },
                },
                guesses: {
                    where: { userId },
                    select: { selectedIndex: true },
                },
                rewards: {
                    where: { userId },
                    select: { points: true },
                },
                reactions: {
                    select: {
                        userId: true,
                        emoji: true,
                    },
                },
                _count: {
                    select: { guesses: true },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: PAGE_SIZE,
        });
        const now = Date.now();
        return items.map(s => {
            const revealed = s.revealAt.getTime() <= now;
            const isMine = s.creatorId === userId;
            const reactionCounts = {};
            for (const reaction of s.reactions) {
                reactionCounts[reaction.emoji] =
                    (reactionCounts[reaction.emoji] ?? 0) + 1;
            }
            return {
                id: s.id,
                prompt: s.prompt,
                options: Array.isArray(s.options)
                    ? s.options
                    : [],
                visibility: s.visibility,
                createdAt: s.createdAt,
                editedAt: s.editedAt,
                revealAt: s.revealAt,
                revealed,
                isMine,
                canEdit: isMine &&
                    !revealed &&
                    s._count.guesses === 0,
                author: s.visibility === 'NAMED' || isMine
                    ? s.creator
                    : null,
                correctIndex: revealed || isMine
                    ? s.correctIndex
                    : null,
                myGuess: s.guesses[0]?.selectedIndex ?? null,
                myReward: s.rewards[0]?.points ?? 0,
                guessCount: s._count.guesses,
                myReaction: s.reactions.find(r => r.userId === userId)?.emoji ?? null,
                reactionCounts,
            };
        });
    }
    async lockSecret(tx, id) {
        const locked = await tx.$queryRaw `
        SELECT id
        FROM \`BlinkSecret\`
        WHERE id = ${id}
        FOR UPDATE
      `;
        if (!locked.length) {
            throw new common_1.NotFoundException('Secret not found.');
        }
    }
    async edit(userId, id, data) {
        const fields = this.validateFields(data);
        const newRevealTime = data.revealAt
            ? this.validateRevealTime(data.revealAt)
            : undefined;
        return this.prisma.$transaction(async (tx) => {
            await this.lockSecret(tx, id);
            const secret = await tx.blinkSecret.findUnique({
                where: { id },
                select: {
                    creatorId: true,
                    revealAt: true,
                },
            });
            if (!secret) {
                throw new common_1.NotFoundException('Secret not found.');
            }
            if (secret.creatorId !== userId) {
                throw new common_1.ForbiddenException('Only the creator can edit this Secret.');
            }
            if (secret.revealAt.getTime() <= Date.now()) {
                throw new common_1.BadRequestException('Revealed Secrets cannot be edited.');
            }
            const guesses = await tx.blinkSecretGuess.count({
                where: { secretId: id },
            });
            if (guesses > 0) {
                throw new common_1.BadRequestException('Editing is locked because someone has already guessed.');
            }
            await tx.blinkSecret.update({
                where: { id },
                data: {
                    ...fields,
                    ...(newRevealTime
                        ? { revealAt: newRevealTime }
                        : {}),
                    editedAt: new Date(),
                },
            });
            return {
                updated: true,
                id,
            };
        });
    }
    async guess(userId, id, selectedIndex) {
        if (!Number.isInteger(selectedIndex)) {
            throw new common_1.BadRequestException('Invalid answer option.');
        }
        return this.prisma.$transaction(async (tx) => {
            await this.lockSecret(tx, id);
            const secret = await tx.blinkSecret.findUnique({
                where: { id },
                select: {
                    creatorId: true,
                    revealAt: true,
                    options: true,
                },
            });
            if (!secret) {
                throw new common_1.NotFoundException('Secret not found.');
            }
            if (!await this.canSee(userId, secret.creatorId)) {
                throw new common_1.NotFoundException('Secret not found.');
            }
            if (secret.creatorId === userId) {
                throw new common_1.ForbiddenException('You cannot answer your own Secret.');
            }
            if (secret.revealAt.getTime() <= Date.now()) {
                throw new common_1.BadRequestException('This Secret is already revealed.');
            }
            const optionCount = Array.isArray(secret.options)
                ? secret.options.length
                : 0;
            if (selectedIndex < 0 ||
                selectedIndex >= optionCount) {
                throw new common_1.BadRequestException('Invalid answer option.');
            }
            try {
                await tx.blinkSecretGuess.create({
                    data: {
                        secretId: id,
                        userId,
                        selectedIndex,
                    },
                });
            }
            catch (error) {
                if (error instanceof
                    client_1.Prisma.PrismaClientKnownRequestError &&
                    error.code === 'P2002') {
                    throw new common_1.BadRequestException('Your answer is already locked.');
                }
                throw error;
            }
            return {
                saved: true,
                revealAt: secret.revealAt,
            };
        });
    }
    async react(userId, id, emoji) {
        const secret = await this.prisma.blinkSecret.findUnique({
            where: { id },
            select: { creatorId: true },
        });
        if (!secret ||
            !await this.canSee(userId, secret.creatorId)) {
            throw new common_1.NotFoundException('Secret not found.');
        }
        await this.prisma.blinkSecretReaction.upsert({
            where: {
                secretId_userId: {
                    secretId: id,
                    userId,
                },
            },
            create: {
                secretId: id,
                userId,
                emoji,
            },
            update: { emoji },
        });
        return { saved: true };
    }
};
exports.SecretsService = SecretsService;
exports.SecretsService = SecretsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SecretsService);
//# sourceMappingURL=secrets.service.js.map