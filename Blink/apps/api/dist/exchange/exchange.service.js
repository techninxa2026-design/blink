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
exports.ExchangeService = exports.EXCHANGE_MEDIA_DIR = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const prisma_service_1 = require("../prisma/prisma.service");
exports.EXCHANGE_MEDIA_DIR = (0, node_path_1.join)(process.cwd(), 'uploads', 'exchange');
const postInclude = {
    author: {
        select: { id: true, name: true, avatarKey: true },
    },
    media: {
        orderBy: { position: 'asc' },
    },
    responses: {
        orderBy: { createdAt: 'asc' },
        take: 30,
        include: {
            author: {
                select: { id: true, name: true },
            },
        },
    },
    _count: {
        select: { responses: true },
    },
};
const validKinds = [
    client_1.ExchangeKind.OFFER,
    client_1.ExchangeKind.REQUEST,
    client_1.ExchangeKind.ADVICE,
    client_1.ExchangeKind.COLLABORATION,
];
let ExchangeService = class ExchangeService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    validateForm(body) {
        const title = typeof body.title === 'string'
            ? body.title.trim()
            : '';
        const description = typeof body.description === 'string'
            ? body.description.trim()
            : '';
        const kind = body.kind;
        if (title.length < 6 || title.length > 140) {
            throw new common_1.BadRequestException('Title must be 6–140 characters.');
        }
        if (description.length < 20 ||
            description.length > 5000) {
            throw new common_1.BadRequestException('Description must be 20–5000 characters.');
        }
        if (typeof kind !== 'string' ||
            !validKinds.includes(kind)) {
            throw new common_1.BadRequestException('Invalid post type.');
        }
        return {
            title,
            description,
            kind: kind,
        };
    }
    async cleanup(files) {
        await Promise.all(files.map(async (file) => {
            await (0, promises_1.unlink)((0, node_path_1.join)(exports.EXCHANGE_MEDIA_DIR, file.filename)).catch(() => undefined);
        }));
    }
    mediaCreate(files) {
        return files.map((file, position) => ({
            key: file.filename,
            mimeType: file.mimetype,
            position,
        }));
    }
    async list(userId, filters) {
        const currentPage = Number(filters.page ?? 1);
        const page = Number.isSafeInteger(currentPage)
            ? Math.min(10000, Math.max(1, currentPage))
            : 1;
        const search = (filters.search || '')
            .trim()
            .slice(0, 100);
        const kind = validKinds.includes(filters.kind)
            ? filters.kind
            : undefined;
        const where = {
            ...(kind ? { kind } : {}),
            ...(filters.mine === 'true'
                ? { authorId: userId }
                : {}),
            ...(search
                ? {
                    OR: [
                        { title: { contains: search } },
                        { description: { contains: search } },
                    ],
                }
                : {}),
        };
        const take = 10;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.exchangePost.findMany({
                where,
                include: postInclude,
                orderBy: { createdAt: 'desc' },
                take,
                skip: (page - 1) * take,
            }),
            this.prisma.exchangePost.count({ where }),
        ]);
        return {
            items,
            page,
            pages: Math.max(1, Math.ceil(total / take)),
            total,
        };
    }
    async getOne(id) {
        const post = await this.prisma.exchangePost.findUnique({
            where: { id },
            include: postInclude,
        });
        if (!post) {
            throw new common_1.NotFoundException('Exchange post not found.');
        }
        return post;
    }
    async create(userId, body, files) {
        try {
            const data = this.validateForm(body);
            return await this.prisma.exchangePost.create({
                data: {
                    ...data,
                    authorId: userId,
                    media: {
                        create: this.mediaCreate(files),
                    },
                },
                include: postInclude,
            });
        }
        catch (error) {
            await this.cleanup(files);
            throw error;
        }
    }
    async update(userId, id, body, files) {
        try {
            const post = await this.prisma.exchangePost.findUnique({
                where: { id },
                include: { media: true },
            });
            if (!post) {
                throw new common_1.NotFoundException('Exchange post not found.');
            }
            if (post.authorId !== userId) {
                throw new common_1.ForbiddenException('You can edit only your own posts.');
            }
            const data = this.validateForm(body);
            const status = body.status;
            if (status !== undefined &&
                !Object.values(client_1.ExchangeStatus).includes(status)) {
                throw new common_1.BadRequestException('Invalid post status.');
            }
            const updated = await this.prisma.exchangePost.update({
                where: { id },
                data: {
                    ...data,
                    ...(status
                        ? { status: status }
                        : {}),
                    ...(files.length
                        ? {
                            media: {
                                deleteMany: {},
                                create: this.mediaCreate(files),
                            },
                        }
                        : {}),
                },
                include: postInclude,
            });
            if (files.length) {
                await this.cleanup(post.media.map((media) => ({
                    filename: media.key,
                })));
            }
            return updated;
        }
        catch (error) {
            await this.cleanup(files);
            throw error;
        }
    }
    async remove(userId, id) {
        const post = await this.prisma.exchangePost.findUnique({
            where: { id },
            include: { media: true },
        });
        if (!post) {
            throw new common_1.NotFoundException('Exchange post not found.');
        }
        if (post.authorId !== userId) {
            throw new common_1.ForbiddenException('You can delete only your own posts.');
        }
        await this.prisma.exchangePost.delete({
            where: { id },
        });
        await this.cleanup(post.media.map((media) => ({
            filename: media.key,
        })));
        return { success: true };
    }
    async reply(userId, postId, value) {
        const message = typeof value === 'string' ? value.trim() : '';
        if (message.length < 2 ||
            message.length > 600) {
            throw new common_1.BadRequestException('Your message must be 2–600 characters.');
        }
        const post = await this.prisma.exchangePost.findUnique({
            where: { id: postId },
        });
        if (!post) {
            throw new common_1.NotFoundException('Exchange post not found.');
        }
        if (post.status === client_1.ExchangeStatus.CLOSED) {
            throw new common_1.BadRequestException('This exchange is closed.');
        }
        if (post.authorId === userId) {
            throw new common_1.BadRequestException('You cannot reply to your own exchange post.');
        }
        return this.prisma.exchangeResponse.create({
            data: {
                postId,
                authorId: userId,
                message,
            },
            include: {
                author: {
                    select: { id: true, name: true },
                },
            },
        });
    }
    async acknowledge(userId, postId, responseId) {
        const response = await this.prisma.exchangeResponse.findFirst({
            where: { id: responseId, postId },
            include: {
                post: {
                    select: { authorId: true },
                },
            },
        });
        if (!response) {
            throw new common_1.NotFoundException('Response not found.');
        }
        if (response.post.authorId !== userId) {
            throw new common_1.ForbiddenException('Only the post author can acknowledge help.');
        }
        return this.prisma.exchangeResponse.update({
            where: { id: responseId },
            data: {
                acknowledgedAt: response.acknowledgedAt ?? new Date(),
            },
        });
    }
    async getMedia(id) {
        const media = await this.prisma.exchangeMedia.findUnique({
            where: { id },
        });
        if (!media) {
            throw new common_1.NotFoundException('Attachment not found.');
        }
        if (!/^[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm|mov)$/.test(media.key)) {
            throw new common_1.NotFoundException('Attachment not found.');
        }
        return media;
    }
};
exports.ExchangeService = ExchangeService;
exports.ExchangeService = ExchangeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExchangeService);
//# sourceMappingURL=exchange.service.js.map