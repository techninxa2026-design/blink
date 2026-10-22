import { PrismaService } from '../prisma/prisma.service';
export declare class IrlService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private friendIds;
    list(userId: string): Promise<{
        invitations: ({
            recipient: {
                id: string;
                name: string;
                avatarKey: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            planId: string;
            recipientId: string;
            status: import("@prisma/client").$Enums.IrlInvitationStatus;
        })[];
        creator: {
            id: string;
            name: string;
            avatarKey: string | null;
        };
        interests: ({
            user: {
                id: string;
                name: string;
                avatarKey: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            planId: string;
            userId: string;
            reply: string;
        })[];
        id: string;
        creatorId: string;
        title: string;
        category: string;
        description: string | null;
        place: string | null;
        startsAt: Date;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(userId: string, input: unknown): Promise<{
        id: string;
        creatorId: string;
        title: string;
        category: string;
        description: string | null;
        place: string | null;
        startsAt: Date;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(userId: string, id: string): Promise<{
        deleted: boolean;
    }>;
    interest(userId: string, id: string, input: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        planId: string;
        userId: string;
        reply: string;
    }>;
    withdraw(userId: string, id: string): Promise<{
        deleted: boolean;
    }>;
    invitations(userId: string): Promise<({
        plan: {
            creator: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            creatorId: string;
            title: string;
            category: string;
            description: string | null;
            place: string | null;
            startsAt: Date;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        planId: string;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
    })[]>;
    invite(userId: string, planId: string, recipientId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        planId: string;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
    }>;
    respondInvitation(userId: string, invitationId: string, status: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        planId: string;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
    } | null>;
    private requireInboxAccess;
    inboxMessages(userId: string, planId: string): Promise<{
        plan: {
            id: string;
            creatorId: string;
            title: string;
            place: string | null;
            startsAt: Date;
        };
        messages: any;
    }>;
    sendInboxMessage(userId: string, planId: string, input: unknown): Promise<any>;
}
