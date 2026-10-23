import { InboxService } from './inbox.service';
import type { Response } from 'express';
type AuthenticatedRequest = {
    user: {
        userId: string;
    };
};
export declare class InboxController {
    private readonly inboxService;
    constructor(inboxService: InboxService);
    listConversations(req: AuthenticatedRequest): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isGroup: boolean;
        groupName: string | null;
        members: {
            user: {
                name: string;
                id: string;
                avatarKey: string | null;
                bio: string | null;
            };
            role: string;
        }[] | undefined;
        otherUser: {
            name: string;
            id: string;
            avatarKey: string | null;
            bio: string | null;
        } | null;
        lastMessage: {
            id: string;
            createdAt: Date;
            senderId: string;
            mediaKey: string | null;
            body: string | null;
            mediaType: string | null;
            mediaMime: string | null;
            isPrivate: boolean;
            privateOpenedAt: Date | null;
            unsentAt: Date | null;
        } | null;
        muted: boolean;
        blockedByMe: boolean;
        blockedByOther: boolean;
        unreadCount: number;
    }[]>;
    listMessageableFriends(req: AuthenticatedRequest): Promise<{
        name: string;
        id: string;
        avatarKey: string | null;
        bio: string | null;
    }[]>;
    openConversation(req: AuthenticatedRequest, body: {
        friendId?: string;
    }): Promise<{
        conversationId: string;
    }>;
    createGroup(req: AuthenticatedRequest, body: {
        name?: unknown;
        friendIds?: unknown;
    }): Promise<{
        conversationId: string;
    }>;
    renameGroup(req: AuthenticatedRequest, id: string, body: {
        name?: unknown;
    }): Promise<{
        ok: boolean;
    }>;
    addGroupMembers(req: AuthenticatedRequest, id: string, body: {
        friendIds?: unknown;
    }): Promise<{
        ok: boolean;
    }>;
    removeGroupMember(req: AuthenticatedRequest, id: string, targetId: string): Promise<{
        ok: boolean;
    }>;
    leaveGroup(req: AuthenticatedRequest, id: string): Promise<{
        ok: boolean;
    }>;
    search(req: AuthenticatedRequest, id: string, q: string): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        body: string | null;
    }[]>;
    mute(req: AuthenticatedRequest, id: string, body: {
        muted?: unknown;
    }): Promise<{
        muted: boolean;
    }>;
    clearConversation(req: AuthenticatedRequest, id: string): Promise<{
        ok: boolean;
    }>;
    block(req: AuthenticatedRequest, id: string, body: {
        blocked?: unknown;
    }): Promise<{
        blocked: boolean;
    }>;
    getConversation(req: AuthenticatedRequest, id: string, around?: string): Promise<{
        id: string;
        isGroup: boolean;
        groupName: string | null;
        groupOwnerId: string | null;
        members: {
            user: {
                name: string;
                id: string;
                avatarKey: string | null;
                bio: string | null;
            };
            role: string;
        }[] | undefined;
        otherUser: {
            name: string;
            id: string;
            avatarKey: string | null;
            bio: string | null;
        } | null;
        messages: {
            privateOpenedAt: Date | null;
            id: string;
            createdAt: Date;
            senderId: string;
            mediaKey: string | null;
            body: string | null;
            mediaType: string | null;
            mediaMime: string | null;
            isPrivate: boolean;
            editedAt: Date | null;
            unsentAt: Date | null;
            replyToId: string | null;
            forwarded: boolean;
            reactions: {
                userId: string;
                emoji: string;
            }[];
            privateViews: {
                userId: string;
            }[];
        }[];
        pinnedMessage: {
            id: string;
            body: string | null;
            mediaType: string | null;
            isPrivate: boolean;
        } | null;
        muted: boolean;
        blockedByMe: boolean;
        blockedByOther: boolean;
        otherLastReadAt: Date | null;
        createdAt: Date;
    }>;
    markRead(req: AuthenticatedRequest, id: string): Promise<{
        lastReadAt: Date;
    }>;
    sendMessage(req: AuthenticatedRequest, id: string, body: {
        body?: unknown;
        replyToId?: unknown;
    }): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        mediaKey: string | null;
        body: string | null;
        mediaType: string | null;
        isPrivate: boolean;
        privateOpenedAt: Date | null;
        editedAt: Date | null;
        replyToId: string | null;
        forwarded: boolean;
    }>;
    pinMessage(req: AuthenticatedRequest, id: string, body: {
        messageId?: unknown;
    }): Promise<{
        ok: boolean;
    }>;
    forwardMessage(req: AuthenticatedRequest, id: string, body: {
        friendIds?: unknown;
    }): Promise<{
        ok: boolean;
        messageIds: string[];
    }>;
    editMessage(req: AuthenticatedRequest, id: string, body: {
        body?: unknown;
    }): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        mediaKey: string | null;
        conversationId: string;
        body: string | null;
        mediaType: string | null;
        mediaMime: string | null;
        isPrivate: boolean;
        privateOpenedAt: Date | null;
        editedAt: Date | null;
        unsentAt: Date | null;
        replyToId: string | null;
        forwarded: boolean;
    }>;
    hideMessage(req: AuthenticatedRequest, id: string): Promise<{
        ok: boolean;
    }>;
    unsendMessage(req: AuthenticatedRequest, id: string): Promise<{
        ok: boolean;
    }>;
    react(req: AuthenticatedRequest, id: string, body: {
        emoji?: unknown;
    }): Promise<{
        ok: boolean;
    }>;
    sendMedia(req: AuthenticatedRequest, id: string, file: Express.Multer.File, body: {
        isPrivate?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        mediaKey: string | null;
        body: string | null;
        mediaType: string | null;
        mediaMime: string | null;
        isPrivate: boolean;
        privateOpenedAt: Date | null;
        editedAt: Date | null;
    }>;
    media(req: AuthenticatedRequest, messageId: string, res: Response): Promise<void>;
    openPrivateMedia(req: AuthenticatedRequest, messageId: string, res: Response): Promise<void>;
}
export {};
