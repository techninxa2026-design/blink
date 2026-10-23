import { SecretsService } from './secrets.service';
type AuthReq = {
    user: {
        userId: string;
    };
};
declare class CreateSecretDto {
    prompt: string;
    options: string[];
    correctIndex: number;
    visibility: 'ANONYMOUS' | 'NAMED';
    revealAt: string;
}
declare class EditSecretDto {
    prompt: string;
    options: string[];
    correctIndex: number;
    visibility: 'ANONYMOUS' | 'NAMED';
    revealAt?: string;
}
declare class GuessDto {
    selectedIndex: number;
}
declare class ReactDto {
    emoji: string;
}
export declare class SecretsController {
    private readonly service;
    constructor(service: SecretsService);
    points(req: AuthReq): Promise<{
        points: number;
        correctGuessReward: number;
    }>;
    list(req: AuthReq): Promise<{
        id: string;
        prompt: string;
        options: import("@prisma/client/runtime/library").JsonArray;
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
    create(req: AuthReq, dto: CreateSecretDto): Promise<{
        id: string;
        created: boolean;
    }>;
    edit(req: AuthReq, id: string, dto: EditSecretDto): Promise<{
        updated: boolean;
        id: string;
    }>;
    guess(req: AuthReq, id: string, dto: GuessDto): Promise<{
        saved: boolean;
        revealAt: Date;
    }>;
    react(req: AuthReq, id: string, dto: ReactDto): Promise<{
        saved: boolean;
    }>;
}
export {};
