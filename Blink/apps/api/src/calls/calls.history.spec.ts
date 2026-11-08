import { jest } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service';
import { CallsService, type CallSession } from './calls.service';

describe('Blink persistent one-to-one call history', () => {
  const call: CallSession = {
    id: 'call-001',
    callerId: 'alice',
    calleeId: 'bob',
    callerName: 'Alice',
    callerSocketId: 'socket-a',
    calleeSocketId: null,
    startedAt: 1000,
    kind: 'audio',
    state: 'ringing',
  };

  function setup(exists = true) {
    const events: Array<Record<string, unknown>> = [];
    const tx = {
      conversation: {
        findFirst: jest.fn(async () => exists ? { id: 'direct-chat' } : null),
        update: jest.fn(async () => ({ id: 'direct-chat' })),
      },
      message: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async (args: { data: Record<string, unknown> }) => {
          events.push(args.data);
          return { id: args.data.id };
        }),
      },
    };
    const db = {
      $transaction: async <T>(task: (prisma: typeof tx) => Promise<T>) => task(tx),
    } as unknown as PrismaService;
    return { service: new CallsService(db), tx, events };
  }

  it('creates one call event in an existing direct conversation on missed calls', async () => {
    const { service, events, tx } = setup();
    await service.persistOutcome(call, 'missed');
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('blink_call_call-001');
    expect(events[0].conversationId).toBe('direct-chat');
    expect(events[0].senderId).toBe('alice');
    expect(events[0].mediaType).toBe('call');
    expect(JSON.parse(events[0].body as string)).toMatchObject({
      kind: 'audio', outcome: 'missed', durationSeconds: 0,
    });
    expect(tx.conversation.update).toHaveBeenCalledTimes(1);
  });

  it('stores finished video-call duration from accepted time', async () => {
    const { service, events } = setup();
    await service.persistOutcome({
      ...call,
      kind: 'video',
      state: 'connected',
      acceptedAt: Date.now() - 94_000,
    }, 'ended');
    expect(JSON.parse(events[0].body as string)).toMatchObject({
      kind: 'video', outcome: 'completed',
    });
    const duration = JSON.parse(events[0].body as string).durationSeconds as number;
    expect(duration).toBeGreaterThanOrEqual(93);
    expect(duration).toBeLessThanOrEqual(95);
  });

  it('never creates a group or unrelated conversation if no direct chat exists', async () => {
    const { service, events, tx } = setup(false);
    await service.persistOutcome(call, 'missed');
    expect(events).toHaveLength(0);
    expect(tx.message.create).not.toHaveBeenCalled();
  });

  it('retries never duplicate a call event with the same deterministic ID', async () => {
    const { service, events, tx } = setup();
    tx.message.findUnique.mockImplementation(async () => ({ id: 'blink_call_call-001' }) as never);
    await service.persistOutcome(call, 'missed');
    expect(events).toHaveLength(0);
  });
});
