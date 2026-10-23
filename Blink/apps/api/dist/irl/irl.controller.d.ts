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
    invite(req: AuthRequest, id: string, body: {
        recipientId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
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
    create(req: AuthRequest, body: unknown): Promise<{
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
    remove(req: AuthRequest, id: string): Promise<{
        deleted: boolean;
    }>;
    interest(req: AuthRequest, id: string, body: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        planId: string;
        reply: string;
    }>;
    withdraw(req: AuthRequest, id: string): Promise<{
        deleted: boolean;
    }>;
}
export {};
