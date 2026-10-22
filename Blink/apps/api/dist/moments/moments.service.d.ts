import { PrismaService } from '../prisma/prisma.service';
export declare class MomentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(userId: string, file: Express.Multer.File, caption?: string): Promise<{
        id: string;
        senderId: string;
        mediaUrl: string;
        mediaType: string;
        caption: string | null;
        createdAt: Date;
    }>;
    findFeed(): Promise<{
        sender: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
        id: string;
        senderId: string;
        mediaUrl: string;
        mediaType: string;
        caption: string | null;
        createdAt: Date;
    }[]>;
    findMine(userId: string): Promise<{
        id: string;
        senderId: string;
        mediaUrl: string;
        mediaType: string;
        caption: string | null;
        createdAt: Date;
    }[]>;
    recordView(userId: string, momentId: string): Promise<{
        message: string;
    }>;
    getViews(userId: string, momentId: string): Promise<{
        viewerId: string;
        name: string;
        avatarKey: string | null;
        viewedAt: Date;
    }[]>;
    remove(userId: string, momentId: string): Promise<{
        message: string;
    }>;
    private formatMoment;
}
