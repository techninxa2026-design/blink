import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { CallsService } from './calls.service';

describe('Authenticated friend-to-friend calling', () => {
  function setup({ friends = true, blocked = false } = {}) {
    const findUnique = jest.fn(async () => friends ? { id: 'friendship' } : null);
    const findFirst = jest.fn(async () => blocked ? { blockerId: 'alice' } : null);
    const findUser = jest.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'alice' ? { name: 'Alice' } : { id: 'bob' });
    const service = new CallsService({
      friendship: { findUnique },
      userBlock: { findFirst },
      user: { findUnique: findUser },
    } as unknown as PrismaService);
    return { service, findUnique, findFirst };
  }

  it('rejects self-calls, invalid kind and non-friends', async () => {
    const { service } = setup({ friends: false });
    await expect(service.initiate('alice', 'alice', 'socket-a', 'audio'))
      .rejects.toThrow(BadRequestException);
    await expect(service.initiate('alice', 'bob', 'socket-a', 'text'))
      .rejects.toThrow(BadRequestException);
    await expect(service.initiate('alice', 'bob', 'socket-a', 'audio'))
      .rejects.toThrow(ForbiddenException);
  });

  it('prevents calls if either person blocked the other', async () => {
    const { service } = setup({ blocked: true });
    await expect(service.initiate('alice', 'bob', 'socket-a', 'video'))
      .rejects.toThrow(ForbiddenException);
  });

  it('reserves both participants and rejects overlapping calls', async () => {
    const { service } = setup();
    const first = await service.initiate('alice', 'bob', 'socket-a', 'audio');
    expect(first.state).toBe('ringing');
    expect(first.callerName).toBe('Alice');
    await expect(service.initiate('alice', 'bob', 'socket-a', 'video'))
      .rejects.toThrow(BadRequestException);
    const finished = service.complete(first.id);
    expect(finished?.id).toBe(first.id);
    expect(service.complete(first.id)).toBeNull();
    await expect(service.initiate('alice', 'bob', 'socket-b', 'video'))
      .resolves.toMatchObject({ kind: 'video', callerId: 'alice' });
  });

  it('isolates media signals to the selected caller/callee sockets', async () => {
    const { service } = setup();
    const call = await service.initiate('alice', 'bob', 'socket-a', 'video');
    expect(() => service.find(call.id, 'stranger')).toThrow(ForbiddenException);
    expect(() => service.accept(call.id, 'alice', 'spoofed')).toThrow(ForbiddenException);
    service.accept(call.id, 'bob', 'socket-b');
    expect(service.peerSocket(call.id, 'alice', 'socket-a')).toBe('socket-b');
    expect(service.peerSocket(call.id, 'bob', 'socket-b')).toBe('socket-a');
    expect(() => service.peerSocket(call.id, 'bob', 'wrong-device'))
      .toThrow(ForbiddenException);
    expect(() => service.accept(call.id, 'bob', 'socket-b'))
      .toThrow(ForbiddenException);
    service.complete(call.id);
  });
});
