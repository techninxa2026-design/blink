import { PrismaService } from '../prisma/prisma.service';
export declare class IrlService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private friendIds;
    list(userId: string): Promise<{
        invitations: ({
            recipient: {
                name: string;
                id: string;
                avatarKey: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            recipientId: string;
            status: import("@prisma/client").$Enums.IrlInvitationStatus;
            planId: string;
        })[];
        creator: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
        interests: ({
            user: {
                name: string;
                id: string;
                avatarKey: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            planId: string;
            reply: string;
        })[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        creatorId: string;
        title: string;
        category: string;
        description: string | null;
        place: string | null;
        startsAt: Date;
    }[]>;
    create(userId: string, input: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        creatorId: string;
        title: string;
        category: string;
        description: string | null;
        place: string | null;
        startsAt: Date;
    }>;
    remove(userId: string, id: string): Promise<{
        deleted: boolean;
    }>;
    interest(userId: string, id: string, input: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        planId: string;
        reply: string;
    }>;
    withdraw(userId: string, id: string): Promise<{
        deleted: boolean;
    }>;
    invitations(userId: string): Promise<({
        plan: {
            creator: {
                name: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            creatorId: string;
            title: string;
            category: string;
            description: string | null;
            place: string | null;
            startsAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        planId: string;
    })[]>;
    invite(userId: string, planId: string, recipientId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        planId: string;
    }>;
    respondInvitation(userId: string, invitationId: string, status: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        planId: string;
    } | null>;
}
