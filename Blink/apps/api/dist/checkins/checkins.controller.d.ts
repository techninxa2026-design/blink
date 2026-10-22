import { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { CheckinsService } from './checkins.service';
type AuthedRequest = {
    user: AuthenticatedUser;
};
export declare class CheckinsController {
    private readonly checkins;
    constructor(checkins: CheckinsService);
    feed(req: AuthedRequest): Promise<({
        user: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        expiresAt: Date | null;
        status: string;
        emoji: string;
        note: string | null;
        duration: string;
    })[]>;
    mine(req: AuthedRequest): Promise<({
        user: {
            name: string;
            id: string;
            avatarKey: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        expiresAt: Date | null;
        status: string;
        emoji: string;
        note: string | null;
        duration: string;
    }) | null>;
    create(req: AuthedRequest, body: unknown): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        expiresAt: Date | null;
        status: string;
        emoji: string;
        note: string | null;
        duration: string;
    }>;
    update(req: AuthedRequest, id: string, body: unknown): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        expiresAt: Date | null;
        status: string;
        emoji: string;
        note: string | null;
        duration: string;
    } | null>;
    remove(req: AuthedRequest, id: string): Promise<{
        message: string;
    }>;
}
export {};
