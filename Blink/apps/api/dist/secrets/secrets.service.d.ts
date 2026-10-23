import { BlinkSecretVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
type SecretInput = {
    prompt: string;
    options: string[];
    correctIndex: number;
    visibility: BlinkSecretVisibility;
    revealAt?: string;
};
export declare class SecretsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private friendIds;
    private canSee;
    private validateFields;
    private validateRevealTime;
    private settle;
    points(userId: string): Promise<{
        points: number;
        correctGuessReward: number;
    }>;
    create(userId: string, data: SecretInput & {
        revealAt: string;
    }): Promise<{
        id: string;
        created: boolean;
    }>;
    list(userId: string): Promise<{
        id: string;
        prompt: string;
        options: Prisma.JsonArray;
        visibility: import("@prisma/client").$Enums.BlinkSecretVisibility;
        createdAt: Date;
        editedAt: Date | null;
        revealAt: Date;
        revealed: boolean;
        isMine: boolean;
        canEdit: boolean;
        author: {
            name: string;
            id: string;
            avatarKey: string | null;
        } | null;
        correctIndex: number | null;
        myGuess: number;
        myReward: number;
        guessCount: number;
        myReaction: string | null;
        reactionCounts: Record<string, number>;
    }[]>;
    private lockSecret;
    edit(userId: string, id: string, data: SecretInput): Promise<{
        updated: boolean;
        id: string;
    }>;
    guess(userId: string, id: string, selectedIndex: number): Promise<{
        saved: boolean;
        revealAt: Date;
    }>;
    react(userId: string, id: string, emoji: string): Promise<{
        saved: boolean;
    }>;
}
export {};
