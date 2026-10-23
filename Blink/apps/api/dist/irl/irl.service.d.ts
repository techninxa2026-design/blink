import { PrismaService } from '../prisma/prisma.service';
export declare class IrlService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private friendIds;
    list(userId: string): Promise<{
        participants: {
            id: string;
            name: string;
        }[];
        meetupLat: number | null;
        meetupLng: number | null;
        meetupUrl: string | null;
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
        meetupLat: number | null;
        meetupLng: number | null;
        meetupUrl: string | null;
        startsAt: Date;
    }>;
    updateMeetupLocation(userId: string, planId: string, input: unknown): Promise<{
        updated: boolean;
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
    removeParticipant(userId: string, planId: string, participantId: string): Promise<{
        removed: boolean;
        deletedMessages: number;
    }>;
    invitations(userId: string): Promise<({
        plan: {
            id: string;
            title: string;
            place: string | null;
            startsAt: Date;
            creator: {
                name: string;
                id: string;
            };
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
    private requireInboxAccess;
    inboxMessages(userId: string, planId: string): Promise<{
        plan: {
            id: string;
            creatorId: string;
            title: string;
            place: string | null;
            meetupLat: number | null;
            meetupLng: number | null;
            meetupUrl: string | null;
            startsAt: Date;
        };
        messages: ({
            sender: {
                name: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            senderId: string;
            planId: string;
            text: string;
        })[];
    }>;
    sendInboxMessage(userId: string, planId: string, input: unknown): Promise<{
        sender: {
            name: string;
            id: string;
        };
    } & {
        id: string;
        createdAt: Date;
        senderId: string;
        planId: string;
        text: string;
    }>;
}
