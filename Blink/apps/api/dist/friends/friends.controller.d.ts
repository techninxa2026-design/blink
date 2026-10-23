import type { Request } from 'express';
import { type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';
interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}
export declare class FriendsController {
    private readonly friendsService;
    constructor(friendsService: FriendsService);
    searchUsers(req: AuthenticatedRequest, query?: string): Promise<{
        name: string;
        id: string;
        avatarKey: string | null;
        bio: string | null;
    }[]>;
    sendRequest(req: AuthenticatedRequest, body: {
        receiverId?: string;
    }): Promise<{
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
    getIncoming(req: AuthenticatedRequest): Promise<({
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
    getOutgoing(req: AuthenticatedRequest): Promise<({
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
    accept(req: AuthenticatedRequest, id: string): Promise<{
        message: string;
        friendId: string;
    }>;
    decline(req: AuthenticatedRequest, id: string): Promise<{
        message: string;
    }>;
    getFriends(req: AuthenticatedRequest): Promise<{
        friendshipId: string;
        createdAt: Date;
        user: {
            name: string;
            id: string;
            avatarKey: string | null;
            bio: string | null;
        };
    }[]>;
    unfriend(req: AuthenticatedRequest, userId: string): Promise<{
        message: string;
    }>;
}
export {};
