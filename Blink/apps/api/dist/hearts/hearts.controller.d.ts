import { HeartsService } from './hearts.service';
type AuthRequest = {
    user: {
        userId: string;
    };
};
declare class SendHeartDto {
    receiverId: string;
    text: string;
}
declare class SendMessageDto {
    text: string;
}
declare class EditMessageDto {
    text: string;
}
declare class RespondHeartDto {
    status: 'ACCEPTED' | 'DECLINED';
}
export declare class HeartsController {
    private readonly service;
    constructor(service: HeartsService);
    people(req: AuthRequest, search?: string): Promise<{
        name: string;
        id: string;
        avatarKey: string | null;
    }[]>;
    incoming(req: AuthRequest): Promise<{
        id: string;
        side: string;
        status: import("@prisma/client").$Enums.BlinkHeartStatus;
        revealed: boolean;
        person: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        blockedByMe: boolean;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            id: string;
            text: string;
            createdAt: Date;
            editedAt: Date | null;
            fromMe: boolean;
        }[];
    }[]>;
    sent(req: AuthRequest): Promise<{
        id: string;
        side: string;
        status: import("@prisma/client").$Enums.BlinkHeartStatus;
        revealed: boolean;
        person: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        blockedByMe: boolean;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            id: string;
            text: string;
            createdAt: Date;
            editedAt: Date | null;
            fromMe: boolean;
        }[];
    }[]>;
    send(req: AuthRequest, dto: SendHeartDto): Promise<{
        id: string;
        side: string;
        status: import("@prisma/client").$Enums.BlinkHeartStatus;
        revealed: boolean;
        person: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        blockedByMe: boolean;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            id: string;
            text: string;
            createdAt: Date;
            editedAt: Date | null;
            fromMe: boolean;
        }[];
    }>;
    detail(req: AuthRequest, id: string): Promise<{
        id: string;
        side: string;
        status: import("@prisma/client").$Enums.BlinkHeartStatus;
        revealed: boolean;
        person: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        blockedByMe: boolean;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            id: string;
            text: string;
            createdAt: Date;
            editedAt: Date | null;
            fromMe: boolean;
        }[];
    }>;
    message(req: AuthRequest, id: string, dto: SendMessageDto): Promise<{
        id: string;
        side: string;
        status: import("@prisma/client").$Enums.BlinkHeartStatus;
        revealed: boolean;
        person: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        blockedByMe: boolean;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            id: string;
            text: string;
            createdAt: Date;
            editedAt: Date | null;
            fromMe: boolean;
        }[];
    }>;
    editMessage(req: AuthRequest, id: string, messageId: string, dto: EditMessageDto): Promise<{
        id: string;
        side: string;
        status: import("@prisma/client").$Enums.BlinkHeartStatus;
        revealed: boolean;
        person: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        blockedByMe: boolean;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            id: string;
            text: string;
            createdAt: Date;
            editedAt: Date | null;
            fromMe: boolean;
        }[];
    }>;
    respond(req: AuthRequest, id: string, dto: RespondHeartDto): Promise<{
        id: string;
        side: string;
        status: import("@prisma/client").$Enums.BlinkHeartStatus;
        revealed: boolean;
        person: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        blockedByMe: boolean;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            id: string;
            text: string;
            createdAt: Date;
            editedAt: Date | null;
            fromMe: boolean;
        }[];
    }>;
    reveal(req: AuthRequest, id: string): Promise<{
        id: string;
        side: string;
        status: import("@prisma/client").$Enums.BlinkHeartStatus;
        revealed: boolean;
        person: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        blockedByMe: boolean;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            id: string;
            text: string;
            createdAt: Date;
            editedAt: Date | null;
            fromMe: boolean;
        }[];
    }>;
    block(req: AuthRequest, id: string): Promise<{
        blocked: boolean;
    }>;
}
export {};
