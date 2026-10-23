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
exports.ExchangeOfferService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const SUPPORTED_CURRENCIES = [
    'BDT',
    'USD',
    'EUR',
    'GBP',
    'INR',
    'AED',
    'SAR',
    'CAD',
    'AUD',
    'SGD',
];
let ExchangeOfferService = class ExchangeOfferService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async authorizedThread(userId, postId, threadId) {
        const thread = await this.prisma.exchangeThread.findFirst({
            where: {
                id: threadId,
                postId,
            },
            select: {
                id: true,
                requesterId: true,
                post: {
                    select: {
                        authorId: true,
                        status: true,
                    },
                },
            },
        });
        if (!thread) {
            throw new common_1.NotFoundException('Conversation not found.');
        }
        const isCustomer = thread.requesterId === userId;
        const isProvider = thread.post.authorId === userId;
        if (!isCustomer && !isProvider) {
            throw new common_1.ForbiddenException('You cannot access this conversation.');
        }
        const blocked = await this.prisma.userBlock.findFirst({
            where: {
                OR: [
                    {
                        blockerId: thread.post.authorId,
                        blockedId: thread.requesterId,
                    },
                    {
                        blockerId: thread.requesterId,
                        blockedId: thread.post.authorId,
                    },
                ],
            },
            select: {
                blockerId: true,
            },
        });
        if (blocked) {
            throw new common_1.ForbiddenException('Price offers are unavailable for this conversation.');
        }
        return {
            ...thread,
            isCustomer,
            isProvider,
        };
    }
    validateOffer(input) {
        const amount = String(input?.amount ?? '').trim();
        const currency = String(input?.currency ?? '')
            .trim()
            .toUpperCase();
        if (!SUPPORTED_CURRENCIES.includes(currency)) {
            throw new common_1.BadRequestException('Please select a supported currency.');
        }
        if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(amount)) {
            throw new common_1.BadRequestException('Enter a valid price with up to two decimal places.');
        }
        const decimalAmount = new client_1.Prisma.Decimal(amount);
        if (decimalAmount.lte(0) ||
            decimalAmount.gt(new client_1.Prisma.Decimal('9999999999999999.99'))) {
            throw new common_1.BadRequestException('The price must be greater than zero and within the allowed limit.');
        }
        return {
            amount: decimalAmount,
            currency,
        };
    }
    async getOffer(userId, postId, threadId) {
        await this.authorizedThread(userId, postId, threadId);
        return this.prisma.exchangePriceOffer.findUnique({
            where: { threadId },
        });
    }
    async createOffer(userId, postId, threadId, input) {
        const thread = await this.authorizedThread(userId, postId, threadId);
        if (!thread.isCustomer) {
            throw new common_1.ForbiddenException('Only the interested customer can offer a price.');
        }
        if (thread.post.status !== 'OPEN') {
            throw new common_1.BadRequestException('This exchange is closed to new price offers.');
        }
        const value = this.validateOffer(input);
        try {
            return await this.prisma.exchangePriceOffer.create({
                data: {
                    threadId,
                    amount: value.amount,
                    currency: value.currency,
                    status: 'PENDING',
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('This conversation already has a price offer. Edit it while pending.');
            }
            throw error;
        }
    }
    async editOffer(userId, postId, threadId, input) {
        const thread = await this.authorizedThread(userId, postId, threadId);
        if (!thread.isCustomer) {
            throw new common_1.ForbiddenException('Only the customer can edit their offer.');
        }
        if (thread.post.status !== 'OPEN') {
            throw new common_1.BadRequestException('This exchange is closed.');
        }
        const value = this.validateOffer(input);
        const result = await this.prisma.exchangePriceOffer.updateMany({
            where: {
                threadId,
                status: 'PENDING',
            },
            data: {
                amount: value.amount,
                currency: value.currency,
            },
        });
        if (result.count !== 1) {
            throw new common_1.ConflictException('This offer can no longer be edited.');
        }
        return this.prisma.exchangePriceOffer.findUnique({
            where: { threadId },
        });
    }
    async decide(userId, postId, threadId, status) {
        const thread = await this.authorizedThread(userId, postId, threadId);
        if (!thread.isProvider) {
            throw new common_1.ForbiddenException('Only the service provider can accept or decline.');
        }
        const result = await this.prisma.exchangePriceOffer.updateMany({
            where: {
                threadId,
                status: client_1.ExchangeOfferStatus.PENDING,
            },
            data: {
                status,
                decidedAt: new Date(),
            },
        });
        if (result.count !== 1) {
            throw new common_1.ConflictException('No pending offer is available. It may already have been decided.');
        }
        return this.prisma.exchangePriceOffer.findUnique({
            where: { threadId },
        });
    }
    acceptOffer(userId, postId, threadId) {
        return this.decide(userId, postId, threadId, 'ACCEPTED');
    }
    declineOffer(userId, postId, threadId) {
        return this.decide(userId, postId, threadId, 'DECLINED');
    }
};
exports.ExchangeOfferService = ExchangeOfferService;
exports.ExchangeOfferService = ExchangeOfferService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExchangeOfferService);
//# sourceMappingURL=exchange-offer.service.js.map