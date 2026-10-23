import { ExchangeChatService } from './exchange-chat.service';
type AuthenticatedRequest = {
    user: {
        userId: string;
    };
};
export declare class ExchangeChatController {
    private readonly chat;
    constructor(chat: ExchangeChatService);
    myThread(req: AuthenticatedRequest, postId: string): Promise<{
        threadId: string | null;
    }>;
    start(req: AuthenticatedRequest, postId: string): Promise<{
        threadId: string;
    }>;
    interestedPeople(req: AuthenticatedRequest, postId: string): Promise<({
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
    messages(req: AuthenticatedRequest, postId: string, threadId: string): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        text: string;
        sender: {
            name: string;
            id: string;
        };
    }[]>;
    send(req: AuthenticatedRequest, postId: string, threadId: string, body: {
        text?: string;
    }): Promise<{
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
export {};
