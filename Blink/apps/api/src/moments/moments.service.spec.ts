import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { MomentsService } from './moments.service';

describe('MomentsService free Blink Points gifts', () => {
  let serviceConstructor: typeof MomentsService;

  beforeAll(async () => {
    // The production NestJS build supplies __dirname in CommonJS.
    // Jest executes imports as native ESM, so provide it before loading the
    // service rather than changing production upload-directory semantics.
    Object.assign(globalThis, { __dirname: process.cwd() });
    const module = await import('./moments.service');
    serviceConstructor = module.MomentsService;
  });

  function setup() {
    const userUpdate = jest.fn<() => Promise<{ id: string }>>()
      .mockResolvedValue({ id: 'recipient' });
    const receiptCreate = jest.fn<() => Promise<{ id: string }>>()
      .mockResolvedValue({ id: 'gift-1' });
    const tx = {
      user: { update: userUpdate },
      momentBpGift: { create: receiptCreate },
    };
    const transaction = jest.fn(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );
    const service = new serviceConstructor({
      $transaction: transaction,
    } as unknown as PrismaService);
    Object.defineProperty(service, 'activePublicMoment', {
      value: jest.fn<() => Promise<{ id: string; senderId: string }>>()
        .mockResolvedValue({ id: 'moment-1', senderId: 'recipient' }),
      configurable: true,
    });
    return { service, transaction, userUpdate, receiptCreate };
  }

  it.each([1, 5, 10, 25, 50, 100])(
    'credits %i free BP and records a receipt without debiting the giver',
    async (amount) => {
      const { service, transaction, userUpdate, receiptCreate } = setup();
      await expect(service.giftPoints('sender-with-zero-bp', 'moment-1', amount))
        .resolves.toEqual({ ok: true, amount });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(userUpdate).toHaveBeenCalledTimes(1);
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: 'recipient' },
        data: { blinkPoints: { increment: amount } },
      });
      expect(receiptCreate).toHaveBeenCalledWith({
        data: {
          momentId: 'moment-1',
          senderId: 'sender-with-zero-bp',
          amount,
        },
      });
    },
  );

  it('rejects gifts to your own Moment', async () => {
    const { service, userUpdate, receiptCreate } = setup();
    await expect(service.giftPoints('recipient', 'moment-1', 5))
      .rejects.toThrow(BadRequestException);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(receiptCreate).not.toHaveBeenCalled();
  });

  it.each([0, -1, 101, 2.5, '5', null])(
    'rejects invalid BP amount: %s',
    async (amount) => {
      const { service, userUpdate } = setup();
      await expect(service.giftPoints('sender', 'moment-1', amount))
        .rejects.toThrow(BadRequestException);
      expect(userUpdate).not.toHaveBeenCalled();
    },
  );
});
