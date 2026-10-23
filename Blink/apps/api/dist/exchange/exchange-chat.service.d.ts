import { PrismaService } from '../prisma/prisma.service';
export declare class ExchangeChatService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getPost;
    private ensureNotBlocked;
    private getAuthorizedThread;
    myThread(userId: string, postId: string): Promise<{
        threadId: string | null;
    }>;
    startThread(userId: string, postId: string): Promise<{
        threadId: string;
    }>;
    ownerThreads(userId: string, postId: string): Promise<({
        _count: {
            messages: number;
        };
        requester: {
            name: string;
            id: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        postId: string;
        requesterId: string;
    })[]>;
    messages(userId: string, postId: string, threadId: string): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        text: string;
        sender: {
            name: string;
            id: string;
        };
    }[]>;
    sendMessage(userId: string, postId: string, threadId: string, value: unknown): Promise<{
        sender: {
            name: string;
            id: string;
        };
    } & {
        id: string;
        createdAt: Date;
        threadId: string;
        senderId: string;
        text: string;
    }>;
}
