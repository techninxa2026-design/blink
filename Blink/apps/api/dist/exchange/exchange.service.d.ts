import { PrismaService } from '../prisma/prisma.service';
export declare const EXCHANGE_MEDIA_DIR: string;
type ListFilters = {
    search?: string;
    kind?: string;
    mine?: string;
    page?: string;
};
export declare class ExchangeService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private validateForm;
    private cleanup;
    private mediaCreate;
    list(userId: string, filters: ListFilters): Promise<{
        items: ({
            _count: {
                responses: number;
            };
            author: {
                name: string;
                id: string;
                avatarKey: string | null;
            };
            media: {
                id: string;
                key: string;
                mimeType: string;
                position: number;
                postId: string;
            }[];
            responses: ({
                author: {
                    name: string;
                    id: string;
                };
            } & {
                message: string;
                id: string;
                createdAt: Date;
                authorId: string;
                postId: string;
                acknowledgedAt: Date | null;
            })[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string;
            kind: import("@prisma/client").$Enums.ExchangeKind;
            authorId: string;
            status: import("@prisma/client").$Enums.ExchangeStatus;
        })[];
        page: number;
        pages: number;
        total: number;
    }>;
    getOne(id: string): Promise<{
        _count: {
            responses: number;
        };
        author: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
        media: {
            id: string;
            key: string;
            mimeType: string;
            position: number;
            postId: string;
        }[];
        responses: ({
            author: {
                name: string;
                id: string;
            };
        } & {
            message: string;
            id: string;
            createdAt: Date;
            authorId: string;
            postId: string;
            acknowledgedAt: Date | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        kind: import("@prisma/client").$Enums.ExchangeKind;
        authorId: string;
        status: import("@prisma/client").$Enums.ExchangeStatus;
    }>;
    create(userId: string, body: Record<string, unknown>, files: Express.Multer.File[]): Promise<{
        _count: {
            responses: number;
        };
        author: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
        media: {
            id: string;
            key: string;
            mimeType: string;
            position: number;
            postId: string;
        }[];
        responses: ({
            author: {
                name: string;
                id: string;
            };
        } & {
            message: string;
            id: string;
            createdAt: Date;
            authorId: string;
            postId: string;
            acknowledgedAt: Date | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        kind: import("@prisma/client").$Enums.ExchangeKind;
        authorId: string;
        status: import("@prisma/client").$Enums.ExchangeStatus;
    }>;
    update(userId: string, id: string, body: Record<string, unknown>, files: Express.Multer.File[]): Promise<{
        _count: {
            responses: number;
        };
        author: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
        media: {
            id: string;
            key: string;
            mimeType: string;
            position: number;
            postId: string;
        }[];
        responses: ({
            author: {
                name: string;
                id: string;
            };
        } & {
            message: string;
            id: string;
            createdAt: Date;
            authorId: string;
            postId: string;
            acknowledgedAt: Date | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        kind: import("@prisma/client").$Enums.ExchangeKind;
        authorId: string;
        status: import("@prisma/client").$Enums.ExchangeStatus;
    }>;
    remove(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    reply(userId: string, postId: string, value: unknown): Promise<{
        author: {
            name: string;
            id: string;
        };
    } & {
        message: string;
        id: string;
        createdAt: Date;
        authorId: string;
        postId: string;
        acknowledgedAt: Date | null;
    }>;
    acknowledge(userId: string, postId: string, responseId: string): Promise<{
        message: string;
        id: string;
        createdAt: Date;
        authorId: string;
        postId: string;
        acknowledgedAt: Date | null;
    }>;
    getMedia(id: string): Promise<{
        id: string;
        key: string;
        mimeType: string;
        position: number;
        postId: string;
    }>;
}
export {};
