import { PrismaService } from '../prisma/prisma.service';
export declare class CheckinsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private active;
    mine(userId: string): Promise<({
        user: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        status: string;
        expiresAt: Date | null;
        emoji: string;
        note: string | null;
        duration: string;
    }) | null>;
    feed(userId: string): Promise<({
        user: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        status: string;
        expiresAt: Date | null;
        emoji: string;
        note: string | null;
        duration: string;
    })[]>;
    create(userId: string, input: unknown): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        status: string;
        expiresAt: Date | null;
        emoji: string;
        note: string | null;
        duration: string;
    }>;
    update(userId: string, id: string, input: unknown): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        status: string;
        expiresAt: Date | null;
        emoji: string;
        note: string | null;
        duration: string;
    } | null>;
    remove(userId: string, id: string): Promise<{
        message: string;
    }>;
}
