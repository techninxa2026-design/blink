
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ExchangeOfferStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const SUPPORTED_CURRENCIES = [
  'BDT',
  'USD',
  'EUR',
  'GBP',
  'INR',
  'AED',
  'SAR',
  'CAD',
  'AUD',
  'SGD',
] as const;

type OfferInput = {
  amount?: string;
  currency?: string;
};

@Injectable()
export class ExchangeOfferService {
  constructor(private readonly prisma: PrismaService) {}

  private async authorizedThread(
    userId: string,
    postId: string,
    threadId: string,
  ) {
    const thread = await this.prisma.exchangeThread.findFirst({
      where: {
        id: threadId,
        postId,
      },
      select: {
        id: true,
        requesterId: true,
        post: {
          select: {
            authorId: true,
            status: true,
          },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Conversation not found.');
    }

    const isCustomer = thread.requesterId === userId;
    const isProvider = thread.post.authorId === userId;

    if (!isCustomer && !isProvider) {
      throw new ForbiddenException(
        'You cannot access this conversation.',
      );
    }

    const blocked = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          {
            blockerId: thread.post.authorId,
            blockedId: thread.requesterId,
          },
          {
            blockerId: thread.requesterId,
            blockedId: thread.post.authorId,
          },
        ],
      },
      select: {
        blockerId: true,
      },
    });

    if (blocked) {
      throw new ForbiddenException(
        'Price offers are unavailable for this conversation.',
      );
    }

    return {
      ...thread,
      isCustomer,
      isProvider,
    };
  }

  private validateOffer(input: OfferInput) {
    const amount = String(input?.amount ?? '').trim();
    const currency = String(input?.currency ?? '')
      .trim()
      .toUpperCase();

    if (
      !SUPPORTED_CURRENCIES.includes(
        currency as (typeof SUPPORTED_CURRENCIES)[number],
      )
    ) {
      throw new BadRequestException(
        'Please select a supported currency.',
      );
    }

    if (
      !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(amount)
    ) {
      throw new BadRequestException(
        'Enter a valid price with up to two decimal places.',
      );
    }

    const decimalAmount = new Prisma.Decimal(amount);

    if (
      decimalAmount.lte(0) ||
      decimalAmount.gt(
        new Prisma.Decimal('9999999999999999.99'),
      )
    ) {
      throw new BadRequestException(
        'The price must be greater than zero and within the allowed limit.',
      );
    }

    return {
      amount: decimalAmount,
      currency,
    };
  }

  async getOffer(
    userId: string,
    postId: string,
    threadId: string,
  ) {
    await this.authorizedThread(userId, postId, threadId);

    return this.prisma.exchangePriceOffer.findUnique({
      where: { threadId },
    });
  }

  async createOffer(
    userId: string,
    postId: string,
    threadId: string,
    input: OfferInput,
  ) {
    const thread = await this.authorizedThread(
      userId,
      postId,
      threadId,
    );

    if (!thread.isCustomer) {
      throw new ForbiddenException(
        'Only the interested customer can offer a price.',
      );
    }

    if (thread.post.status !== 'OPEN') {
      throw new BadRequestException(
        'This Exchange is closed to new price offers.',
      );
    }

    const value = this.validateOffer(input);

    try {
      return await this.prisma.exchangePriceOffer.create({
        data: {
          threadId,
          amount: value.amount,
          currency: value.currency,
          status: 'PENDING',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This conversation already has a price offer. Edit it while pending.',
        );
      }

      throw error;
    }
  }

  async editOffer(
    userId: string,
    postId: string,
    threadId: string,
    input: OfferInput,
  ) {
    const thread = await this.authorizedThread(
      userId,
      postId,
      threadId,
    );

    if (!thread.isCustomer) {
      throw new ForbiddenException(
        'Only the customer can edit their offer.',
      );
    }

    if (thread.post.status !== 'OPEN') {
      throw new BadRequestException(
        'This Exchange is closed.',
      );
    }

    const value = this.validateOffer(input);

    // Atomic status check: the provider might be accepting
    // or declining the offer at the same time.
    const result = await this.prisma.exchangePriceOffer.updateMany({
      where: {
        threadId,
        status: 'PENDING',
      },
      data: {
        amount: value.amount,
        currency: value.currency,
      },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        'This offer can no longer be edited.',
      );
    }

    return this.prisma.exchangePriceOffer.findUnique({
      where: { threadId },
    });
  }

  private async decide(
    userId: string,
    postId: string,
    threadId: string,
    status: 'ACCEPTED' | 'DECLINED',
  ) {
    const thread = await this.authorizedThread(
      userId,
      postId,
      threadId,
    );

    if (!thread.isProvider) {
      throw new ForbiddenException(
        'Only the service provider can accept or decline.',
      );
    }

    const result = await this.prisma.exchangePriceOffer.updateMany({
      where: {
        threadId,
        status: ExchangeOfferStatus.PENDING,
      },
      data: {
        status,
        decidedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        'No pending offer is available. It may already have been decided.',
      );
    }

    return this.prisma.exchangePriceOffer.findUnique({
      where: { threadId },
    });
  }

  acceptOffer(
    userId: string,
    postId: string,
    threadId: string,
  ) {
    return this.decide(
      userId,
      postId,
      threadId,
      'ACCEPTED',
    );
  }

  declineOffer(
    userId: string,
    postId: string,
    threadId: string,
  ) {
    return this.decide(
      userId,
      postId,
      threadId,
      'DECLINED',
    );
  }
}
