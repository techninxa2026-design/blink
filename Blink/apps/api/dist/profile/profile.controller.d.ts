import type { Request } from 'express';
import { type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';
interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}
type UpdateProfileBody = {
    name?: string;
    bio?: string | null;
};
export declare class ProfileController {
    private readonly profileService;
    constructor(profileService: ProfileService);
    getMyProfile(req: AuthenticatedRequest): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string;
        avatarKey: string | null;
        bio: string | null;
        coverKey: string | null;
        createdAt: Date;
        followersCount: number;
        followingCount: number;
        connectionsCount: number;
    }>;
    getPublicProfile(req: AuthenticatedRequest, userId: string): Promise<{
        connectionsCount: number;
        relationship: string;
        incomingRequestId: string | null;
        moments: {
            id: string;
            mediaUrl: string;
            mediaType: string;
            caption: string | null;
            createdAt: Date;
        }[];
        name: string;
        id: string;
        avatarKey: string | null;
        bio: string | null;
        coverKey: string | null;
        createdAt: Date;
    }>;
    updateMyProfile(req: AuthenticatedRequest, body: UpdateProfileBody): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string;
        avatarKey: string | null;
        bio: string | null;
        coverKey: string | null;
        createdAt: Date;
        followersCount: number;
        followingCount: number;
        connectionsCount: number;
    }>;
    uploadAvatar(req: AuthenticatedRequest, file: Express.Multer.File | undefined): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string;
        avatarKey: string | null;
        bio: string | null;
        coverKey: string | null;
        createdAt: Date;
        followersCount: number;
        followingCount: number;
        connectionsCount: number;
    }>;
    uploadCover(req: AuthenticatedRequest, file: Express.Multer.File | undefined): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string;
        avatarKey: string | null;
        bio: string | null;
        coverKey: string | null;
        createdAt: Date;
        followersCount: number;
        followingCount: number;
        connectionsCount: number;
    }>;
}
export {};
