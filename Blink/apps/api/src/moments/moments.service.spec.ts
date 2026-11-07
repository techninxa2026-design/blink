import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MomentsService } from './moments.service';

describe('MomentsService free Blink Points gifts', () => {
  function setup() {
    const userUpdate = jest.fn().mockResolvedValue({ id: 'recipient' });
    const receiptCreate = jest.fn().mockResolvedValue({ id: 'gift-1' });
    const tx = {
      user: { update: userUpdate },
      momentBpGift: { create: receiptCreate },
    };
    const transaction = jest.fn(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );
    const service = new MomentsService({
      $transaction: transaction,
    } as unknown as PrismaService);
    // Isolate gifting from the unrelated public-Moment database lookup.
    Object.defineProperty(service, 'activePublicMoment', {
      value: jest.fn().mockResolvedValue({
        id: 'moment-1',
        senderId: 'recipient',
      }),
      configurable: true,
    });
    return { service, transaction, userUpdate, receiptCreate };
  }

  it.each([1, 5, 10, 25, 50, 100])(
    'credits %i free BP and writes a receipt without deducting the sender',
    async (amount) => {
      const { service, transaction, userUpdate, receiptCreate } = setup();
      await expect(service.giftPoints('sender-zero-bp', 'moment-1', amount))
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
          senderId: 'sender-zero-bp',
          amount,
        },
      });
    },
  );

  it('cannot award BP to your own Moment', async () => {
    const { service, userUpdate, receiptCreate } = setup();
    await expect(service.giftPoints('recipient', 'moment-1', 5))
      .rejects.toThrow(BadRequestException);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(receiptCreate).not.toHaveBeenCalled();
  });

  it.each([0, -1, 101, 2.5, '5', null])(
    'rejects an invalid amount: %s',
    async (amount) => {
      const { service, userUpdate } = setup();
      await expect(service.giftPoints('sender', 'moment-1', amount))
        .rejects.toThrow(BadRequestException);
      expect(userUpdate).not.toHaveBeenCalled();
    },
  );
});
