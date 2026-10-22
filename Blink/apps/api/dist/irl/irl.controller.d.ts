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
    invite(req: AuthRequest, id: string, body: {
        recipientId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        planId: string;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
    }>;
    respondInvitation(req: AuthRequest, id: string, body: {
        status?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        planId: string;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
    } | null>;
    inboxMessages(req: AuthRequest, id: string): Promise<{
        plan: {
            id: string;
            creatorId: string;
            title: string;
            place: string | null;
            startsAt: Date;
        };
        messages: any;
    }>;
    sendInboxMessage(req: AuthRequest, id: string, body: unknown): Promise<any>;
    plans(req: AuthRequest): Promise<{
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
    create(req: AuthRequest, body: unknown): Promise<{
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
    remove(req: AuthRequest, id: string): Promise<{
        deleted: boolean;
    }>;
    interest(req: AuthRequest, id: string, body: unknown): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        planId: string;
        userId: string;
        reply: string;
    }>;
    withdraw(req: AuthRequest, id: string): Promise<{
        deleted: boolean;
    }>;
}
export {};
