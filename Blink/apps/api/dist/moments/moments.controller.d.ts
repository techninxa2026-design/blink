import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { MomentsService } from './moments.service';
interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}
export declare class MomentsController {
    private readonly momentsService;
    constructor(momentsService: MomentsService);
    upload(req: AuthenticatedRequest, file: Express.Multer.File | undefined, caption?: string): Promise<{
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
    findMine(req: AuthenticatedRequest): Promise<{
        id: string;
        senderId: string;
        mediaUrl: string;
        mediaType: string;
        caption: string | null;
        createdAt: Date;
    }[]>;
    recordView(req: AuthenticatedRequest, id: string): Promise<{
        message: string;
    }>;
    getViews(req: AuthenticatedRequest, id: string): Promise<{
        viewerId: string;
        name: string;
        avatarKey: string | null;
        viewedAt: Date;
    }[]>;
    remove(req: AuthenticatedRequest, id: string): Promise<{
        message: string;
    }>;
}
export {};
