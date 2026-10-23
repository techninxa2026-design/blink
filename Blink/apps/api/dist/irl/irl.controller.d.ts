import { IrlService } from './irl.service';
type AuthRequest = {
    user: {
        userId: string;
    };
};
export declare class IrlController {
    private readonly service;
    constructor(service: IrlService);
    invitations(req: AuthRequest): Promise<({
        plan: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string | null;
            creatorId: string;
            category: string;
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
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        recipientId: string;
        planId: string;
    })[]>;
    invite(req: AuthRequest, id: string, body: {
        recipientId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        recipientId: string;
        planId: string;
    }>;
    removeParticipant(req: AuthRequest, id: string, participantId: string): Promise<{
        removed: boolean;
        deletedMessages: number;
    }>;
    updateLocation(req: AuthRequest, id: string, body: unknown): Promise<{
        updated: boolean;
    }>;
    inboxMessages(req: AuthRequest, id: string): Promise<{
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
    sendInboxMessage(req: AuthRequest, id: string, body: unknown): Promise<{
        sender: {
            name: string;
            id: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        recipientId: string;
        senderId: string;
        planId: string;
        text: string;
    }>;
    plans(req: AuthRequest): Promise<{
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
    create(req: AuthRequest, body: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        creatorId: string;
        category: string;
        place: string | null;
        meetupLat: number | null;
        meetupLng: number | null;
        meetupUrl: string | null;
        startsAt: Date;
    }>;
    remove(req: AuthRequest, id: string): Promise<{
        deleted: boolean;
    }>;
    interest(req: AuthRequest, id: string, body: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        reply: string;
        planId: string;
    }>;
    withdraw(req: AuthRequest, id: string): Promise<{
        deleted: boolean;
    }>;
}
export {};
