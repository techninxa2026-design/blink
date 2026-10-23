import { PrismaService } from '../prisma/prisma.service';
export declare class HeartsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private checkNotBlocked;
    private project;
    private load;
    people(userId: string, search: string): Promise<{
        name: string;
        id: string;
        avatarKey: string | null;
    }[]>;
    list(userId: string, side: 'incoming' | 'sent'): Promise<{
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
    detail(userId: string, id: string): Promise<{
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
    send(senderId: string, receiverId: string, input: string): Promise<{
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
    message(userId: string, id: string, input: string): Promise<{
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
    editMessage(userId: string, id: string, messageId: string, input: string): Promise<{
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
    respond(receiverId: string, id: string, status: 'ACCEPTED' | 'DECLINED'): Promise<{
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
    reveal(senderId: string, id: string): Promise<{
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
    block(receiverId: string, id: string): Promise<{
        blocked: boolean;
    }>;
}
