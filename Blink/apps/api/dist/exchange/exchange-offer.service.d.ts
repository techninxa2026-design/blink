import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
type OfferInput = {
    amount?: string;
    currency?: string;
};
export declare class ExchangeOfferService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private authorizedThread;
    private validateOffer;
    getOffer(userId: string, postId: string, threadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: Prisma.Decimal;
        currency: string;
        decidedAt: Date | null;
    } | null>;
    createOffer(userId: string, postId: string, threadId: string, input: OfferInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: Prisma.Decimal;
        currency: string;
        decidedAt: Date | null;
    }>;
    editOffer(userId: string, postId: string, threadId: string, input: OfferInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: Prisma.Decimal;
        currency: string;
        decidedAt: Date | null;
    } | null>;
    private decide;
    acceptOffer(userId: string, postId: string, threadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: Prisma.Decimal;
        currency: string;
        decidedAt: Date | null;
    } | null>;
    declineOffer(userId: string, postId: string, threadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: Prisma.Decimal;
        currency: string;
        decidedAt: Date | null;
    } | null>;
}
export {};
