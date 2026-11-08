import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { FriendsService } from './friends.service';

describe('Blink friend request → friendship lifecycle', () => {
  let Service: typeof FriendsService;

  beforeAll(async () => {
    Service = (await import('./friends.service')).FriendsService;
  });

  it('sends a request only to a different existing non-friend user', async () => {
    const receiver = jest.fn(async () => ({ id: 'bob' }));
    const friends = jest.fn(async () => null);
    const requests = jest.fn(async () => []);
    const create = jest.fn(async () => ({
      id: 'request-id', senderId: 'alice', receiverId: 'bob',
      status: 'PENDING',
    }));
    const service = new Service({
      user: { findUnique: receiver },
      friendship: { findUnique: friends },
      friendRequest: { findMany: requests, create },
    } as unknown as PrismaService);

    await expect(service.sendRequest('alice', 'bob'))
      .resolves.toMatchObject({
        id: 'request-id', senderId: 'alice', receiverId: 'bob',
      });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        senderId: 'alice', receiverId: 'bob', status: 'PENDING',
      },
    }));
    await expect(service.sendRequest('alice', 'alice'))
      .rejects.toThrow(BadRequestException);
  });

  it('exposes incoming and outgoing pending requests to the correct account', async () => {
    const findMany = jest.fn(async () => []);
    const service = new Service({
      friendRequest: { findMany },
    } as unknown as PrismaService);
    await service.getIncoming('bob');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { receiverId: 'bob', status: 'PENDING' },
    }));
    await service.getOutgoing('alice');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { senderId: 'alice', status: 'PENDING' },
    }));
  });

  it('accepts a pending request and creates the canonical friendship atomically', async () => {
    const request = jest.fn(async () => ({
      id: 'request-id', senderId: 'bob', receiverId: 'alice',
      status: 'PENDING',
    }));
    const mark = jest.fn(async () => ({ count: 1 }));
    const upsert = jest.fn(async () => ({ id: 'friendship-id' }));
    const tx = {
      friendRequest: { updateMany: mark },
      friendship: { upsert },
    };
    const transaction = jest.fn(async (
      work: (db: typeof tx) => Promise<unknown>,
    ) => work(tx));
    const service = new Service({
      friendRequest: { findUnique: request },
      $transaction: transaction,
    } as unknown as PrismaService);
    await expect(service.acceptRequest('alice', 'request-id'))
      .resolves.toEqual({
        message: 'Friend request accepted.', friendId: 'bob',
      });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { userAId_userBId: { userAId: 'alice', userBId: 'bob' } },
      create: { userAId: 'alice', userBId: 'bob' },
      update: {},
    });
    expect(mark).toHaveBeenCalledTimes(2);
  });
});
