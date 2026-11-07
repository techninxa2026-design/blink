import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

  describe('public Moments and legacy expiration timestamps', () => {
    const legacyPublic = {
      id: 'legacy-public',
      senderId: 'creator',
      type: 'PUBLIC',
      recipientId: null as string | null,
      expiresAt: new Date('2024-01-01T00:00:00Z'),
    };

    function fixture(moment: typeof legacyPublic | null = legacyPublic) {
      const findUnique = jest.fn<() => Promise<typeof legacyPublic | null>>()
        .mockResolvedValue(moment);
      const findReaction = jest.fn<() => Promise<null>>()
        .mockResolvedValue(null);
      const upsert = jest.fn<() => Promise<{ id: string }>>()
        .mockResolvedValue({ id: 'reaction-1' });
      const award = jest.fn<() => Promise<{ id: string }>>()
        .mockResolvedValue({ id: 'creator' });
      const receipt = jest.fn<() => Promise<{ id: string }>>()
        .mockResolvedValue({ id: 'gift-1' });
      const tx = {
        user: { update: award },
        momentBpGift: { create: receipt },
      };
      const transaction = jest.fn(
        async (work: (db: typeof tx) => Promise<unknown>) => work(tx),
      );
      const service = new serviceConstructor({
        moment: { findUnique },
        momentReaction: { findUnique: findReaction, upsert },
        $transaction: transaction,
      } as unknown as PrismaService);
      return { service, findUnique, upsert, award, receipt };
    }

    it('reacts to a public Moment even with a legacy past expiresAt', async () => {
      const { service, findUnique, upsert } = fixture();
      await expect(service.react('viewer', 'legacy-public', '❤️'))
        .resolves.toEqual({ ok: true, myReaction: '❤️' });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'legacy-public' },
        select: {
          id: true, senderId: true, type: true, recipientId: true,
        },
      });
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it('awards free BP to public Moment creator even with a past expiresAt', async () => {
      const { service, award, receipt } = fixture();
      await expect(service.giftPoints('viewer-with-zero-bp', 'legacy-public', 10))
        .resolves.toEqual({ ok: true, amount: 10 });
      expect(award).toHaveBeenCalledWith({
        where: { id: 'creator' },
        data: { blinkPoints: { increment: 10 } },
      });
      expect(receipt).toHaveBeenCalledWith({
        data: {
          momentId: 'legacy-public',
          senderId: 'viewer-with-zero-bp',
          amount: 10,
        },
      });
    });

    it.each([
      { ...legacyPublic, type: 'PRIVATE' },
      { ...legacyPublic, recipientId: 'someone-else' },
      null,
    ])('blocks nonpublic or deleted Moments', async (moment) => {
      const { service, upsert, award } = fixture(moment);
      await expect(service.react('viewer', 'legacy-public', '❤️'))
        .rejects.toThrow(NotFoundException);
      await expect(service.giftPoints('viewer', 'legacy-public', 5))
        .rejects.toThrow(NotFoundException);
      expect(upsert).not.toHaveBeenCalled();
      expect(award).not.toHaveBeenCalled();
    });

    it('only lists published public Moments in My Moments', async () => {
      const findMany = jest.fn<() => Promise<[]>>().mockResolvedValue([]);
      const service = new serviceConstructor({
        moment: { findMany },
      } as unknown as PrismaService);
      await expect(service.findMine('viewer')).resolves.toEqual([]);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          senderId: 'viewer',
          type: 'PUBLIC',
          recipientId: null,
        },
      }));
    });
  });
});
