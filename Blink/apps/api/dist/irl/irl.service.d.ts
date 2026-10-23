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
            status: import("@prisma/client").$Enums.IrlInvitationStatus;
            recipientId: string;
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
            reply: string;
            planId: string;
        })[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        creatorId: string;
        category: string;
        place: string | null;
        startsAt: Date;
    }[]>;
    create(userId: string, input: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        creatorId: string;
        category: string;
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
        reply: string;
        planId: string;
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
            title: string;
            description: string | null;
            creatorId: string;
            category: string;
            place: string | null;
            startsAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        recipientId: string;
        planId: string;
    })[]>;
    invite(userId: string, planId: string, recipientId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        recipientId: string;
        planId: string;
    }>;
    respondInvitation(userId: string, invitationId: string, status: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        recipientId: string;
        planId: string;
    } | null>;
}
