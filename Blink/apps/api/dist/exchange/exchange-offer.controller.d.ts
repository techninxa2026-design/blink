import { ExchangeOfferService } from './exchange-offer.service';
type AuthRequest = {
    user: {
        userId: string;
    };
};
type PriceOfferBody = {
    amount?: string;
    currency?: string;
};
export declare class ExchangeOfferController {
    private readonly offers;
    constructor(offers: ExchangeOfferService);
    get(req: AuthRequest, postId: string, threadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        decidedAt: Date | null;
    } | null>;
    create(req: AuthRequest, postId: string, threadId: string, body: PriceOfferBody): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        decidedAt: Date | null;
    }>;
    edit(req: AuthRequest, postId: string, threadId: string, body: PriceOfferBody): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        decidedAt: Date | null;
    } | null>;
    accept(req: AuthRequest, postId: string, threadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        decidedAt: Date | null;
    } | null>;
    decline(req: AuthRequest, postId: string, threadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ExchangeOfferStatus;
        threadId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        decidedAt: Date | null;
    } | null>;
}
export {};
