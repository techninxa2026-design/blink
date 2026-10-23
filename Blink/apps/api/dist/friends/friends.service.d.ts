import { PrismaService } from '../prisma/prisma.service';
export declare class FriendsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getPair;
    private areFriends;
    sendRequest(senderId: string, receiverId?: string): Promise<{
        receiver: {
            name: string;
            id: string;
            avatarKey: string | null;
            bio: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.FriendRequestStatus;
        senderId: string;
        receiverId: string;
    }>;
    getIncoming(userId: string): Promise<({
        sender: {
            name: string;
            id: string;
            avatarKey: string | null;
            bio: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.FriendRequestStatus;
        senderId: string;
        receiverId: string;
    })[]>;
    getOutgoing(userId: string): Promise<({
        receiver: {
            name: string;
            id: string;
            avatarKey: string | null;
            bio: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.FriendRequestStatus;
        senderId: string;
        receiverId: string;
    })[]>;
    acceptRequest(userId: string, requestId: string): Promise<{
        message: string;
        friendId: string;
    }>;
    declineRequest(userId: string, requestId: string): Promise<{
        message: string;
    }>;
    unfriend(userId: string, friendId: string): Promise<{
        message: string;
    }>;
    searchUsers(userId: string, query?: string): Promise<{
        name: string;
        id: string;
        avatarKey: string | null;
        bio: string | null;
    }[]>;
    getFriends(userId: string): Promise<{
        friendshipId: string;
        createdAt: Date;
        user: {
            name: string;
            id: string;
            avatarKey: string | null;
            bio: string | null;
        };
    }[]>;
}
