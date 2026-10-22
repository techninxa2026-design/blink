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
    respondInvitation(req: AuthRequest, id: string, body: {
        status?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        recipientId: string;
        status: import("@prisma/client").$Enums.IrlInvitationStatus;
        planId: string;
    } | null>;
    plans(req: AuthRequest): Promise<{
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
