import { PrismaService } from '../prisma/prisma.service';
export declare class InboxService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private messageForAction;
    editMessage(userId: string, messageId: string, body: unknown): Promise<{
        id: string;
        createdAt: Date;
        mediaKey: string | null;
        senderId: string;
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
    hideMessage(userId: string, messageId: string): Promise<{
        ok: boolean;
    }>;
    unsendMessage(userId: string, messageId: string): Promise<{
        ok: boolean;
    }>;
    reactToMessage(userId: string, messageId: string, emoji: unknown): Promise<{
        ok: boolean;
    }>;
    pinMessage(userId: string, conversationId: string, messageId: unknown): Promise<{
        ok: boolean;
    }>;
    forwardMessage(userId: string, messageId: string, friendIds: unknown): Promise<{
        ok: boolean;
        messageIds: string[];
    }>;
    private assertNotBlocked;
    searchMessages(userId: string, conversationId: string, query: string): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        body: string | null;
    }[]>;
    private getMembership;
    setMute(userId: string, conversationId: string, muted: unknown): Promise<{
        muted: boolean;
    }>;
    clearConversation(userId: string, conversationId: string): Promise<{
        ok: boolean;
    }>;
    setBlock(userId: string, otherId: string, blocked: unknown): Promise<{
        blocked: boolean;
    }>;
    private ensureMember;
    sendMedia(userId: string, conversationId: string, file: Express.Multer.File, isPrivate: boolean): Promise<{
        id: string;
        createdAt: Date;
        mediaKey: string | null;
        senderId: string;
        body: string | null;
        mediaType: string | null;
        mediaMime: string | null;
        isPrivate: boolean;
        privateOpenedAt: Date | null;
        editedAt: Date | null;
    }>;
    getMedia(userId: string, messageId: string, openPrivate: boolean): Promise<{
        stream: import("fs").ReadStream;
        mime: string;
    }>;
    listConversations(userId: string): Promise<{
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
            mediaKey: string | null;
            senderId: string;
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
    listMessageableFriends(userId: string): Promise<{
        name: string;
        id: string;
        avatarKey: string | null;
        bio: string | null;
    }[]>;
    openConversation(userId: string, friendId: string): Promise<{
        conversationId: string;
    }>;
    getConversation(userId: string, conversationId: string, around?: string): Promise<{
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
            mediaKey: string | null;
            senderId: string;
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
    markRead(userId: string, conversationId: string): Promise<{
        lastReadAt: Date;
    }>;
    sendMessage(userId: string, conversationId: string, body: unknown, replyToId?: unknown): Promise<{
        id: string;
        createdAt: Date;
        mediaKey: string | null;
        senderId: string;
        body: string | null;
        mediaType: string | null;
        isPrivate: boolean;
        privateOpenedAt: Date | null;
        editedAt: Date | null;
        replyToId: string | null;
        forwarded: boolean;
    }>;
    private requireGroup;
    private validateGroupName;
    private validateGroupFriends;
    createGroup(userId: string, name: unknown, friendIds: unknown): Promise<{
        conversationId: string;
    }>;
    renameGroup(userId: string, conversationId: string, name: unknown): Promise<{
        ok: boolean;
    }>;
    addGroupMembers(userId: string, conversationId: string, friendIds: unknown): Promise<{
        ok: boolean;
    }>;
    removeGroupMember(userId: string, conversationId: string, targetId: string): Promise<{
        ok: boolean;
    }>;
    leaveGroup(userId: string, conversationId: string): Promise<{
        ok: boolean;
    }>;
}
