import { PrismaService } from '../prisma/prisma.service';
type UpdateProfileBody = {
    name?: string;
    bio?: string | null;
};
export declare class ProfileService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getMyProfile(userId: string): Promise<{
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
    updateMyProfile(userId: string, body: UpdateProfileBody): Promise<{
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
    updateProfileImage(userId: string, file: Express.Multer.File, field: 'avatarKey' | 'coverKey'): Promise<{
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
    getPublicProfile(viewerId: string, userId: string): Promise<{
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
}
export {};
