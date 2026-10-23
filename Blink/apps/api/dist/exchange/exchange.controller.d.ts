import type { Response } from 'express';
import { ExchangeService } from './exchange.service';
type AuthenticatedRequest = {
    user: {
        userId: string;
    };
};
export declare class ExchangeController {
    private readonly exchange;
    constructor(exchange: ExchangeService);
    list(req: AuthenticatedRequest, search?: string, kind?: string, mine?: string, page?: string): Promise<{
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
    create(req: AuthenticatedRequest, body: Record<string, unknown>, files?: Express.Multer.File[]): Promise<{
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
    update(req: AuthenticatedRequest, id: string, body: Record<string, unknown>, files?: Express.Multer.File[]): Promise<{
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
    remove(req: AuthenticatedRequest, id: string): Promise<{
        success: boolean;
    }>;
    reply(req: AuthenticatedRequest, id: string, body: {
        message?: string;
    }): Promise<{
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
    acknowledge(req: AuthenticatedRequest, id: string, responseId: string): Promise<{
        message: string;
        id: string;
        createdAt: Date;
        authorId: string;
        postId: string;
        acknowledgedAt: Date | null;
    }>;
}
export declare class ExchangeMediaController {
    private readonly exchange;
    constructor(exchange: ExchangeService);
    show(id: string, res: Response): Promise<void>;
}
export {};
