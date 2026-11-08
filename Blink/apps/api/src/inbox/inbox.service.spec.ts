import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { InboxService } from './inbox.service';

describe('Inbox friendship and direct messaging flow', () => {
  let Service: typeof InboxService;

  beforeAll(async () => {
    Object.assign(globalThis, { __dirname: process.cwd() });
    Service = (await import('./inbox.service')).InboxService;
  });

  function fixture(allowed = true) {
    let existing: {
      id: string;
      isGroup: boolean;
      members: { userId: string }[];
    } | null = null;
    const lockedFriendship = jest.fn(async () =>
      allowed ? [{ id: 'friendship-id' }] : []);
    const blockLookup = jest.fn(async () => null);
    const lookup = jest.fn(async () => existing);
    const create = jest.fn(async () => {
      existing = {
        id: 'conversation-id', isGroup: false,
        members: [{ userId: 'a' }, { userId: 'b' }],
      };
      return { id: 'conversation-id' };
    });
    const tx = {
      $queryRaw: lockedFriendship,
      userBlock: { findFirst: blockLookup },
      conversation: { findFirst: lookup, create },
    };
    const transaction = jest.fn(async (
      work: (client: typeof tx) => Promise<unknown>,
    ) => work(tx));
    const service = new Service({
      $transaction: transaction,
    } as unknown as PrismaService);
    return { service, transaction, lockedFriendship, blockLookup, lookup, create };
  }

  it('refuses to start chats between people who are not friends', async () => {
    const { service, create } = fixture(false);
    await expect(service.openConversation('a', 'b'))
      .rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses self-messaging and invalid friend selection', async () => {
    const { service, transaction } = fixture();
    await expect(service.openConversation('a', 'a'))
      .rejects.toThrow(BadRequestException);
    await expect(service.openConversation('a', ''))
      .rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('locks the friendship before finding or creating a direct chat', async () => {
    const { service, lockedFriendship, lookup, create } = fixture();
    const result = await service.openConversation('b', 'a');
    expect(result).toEqual({ conversationId: 'conversation-id' });
    expect(lockedFriendship).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(lockedFriendship.mock.invocationCallOrder[0])
      .toBeLessThan(lookup.mock.invocationCallOrder[0]);
  });

  it('reuses the same conversation for Android and Web open requests', async () => {
    const { service, create } = fixture();
    const android = await service.openConversation('a', 'b');
    const web = await service.openConversation('b', 'a');
    expect(web).toEqual(android);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('does not create a conversation if either party is blocked', async () => {
    const { service, blockLookup, create } = fixture();
    blockLookup.mockImplementation(async () =>
      ({ blockerId: 'a', blockedId: 'b' }) as never);
    await expect(service.openConversation('a', 'b'))
      .rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });
});
