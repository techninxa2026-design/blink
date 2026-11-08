import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type CallKind = 'audio' | 'video';
export type CallState = 'ringing' | 'connected';

export interface CallSession {
  id: string;
  callerId: string;
  calleeId: string;
  callerName: string;
  callerSocketId: string;
  calleeSocketId: string | null;
  kind: CallKind;
  state: CallState;
  startedAt: number;
  acceptedAt?: number;
}

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  // Ephemeral signaling state, never private media. One process instance.
  // For horizontal scale use a shared Redis call-state/lock store alongside
  // a Socket.IO Redis adapter; do not point multiple API nodes here as-is.
  private readonly calls = new Map<string, CallSession>();
  private readonly busy = new Map<string, string>();

  async initiate(
    callerId: string, calleeId: string, callerSocketId: string,
    kind: unknown,
  ): Promise<CallSession> {
    if (kind !== 'audio' && kind !== 'video') {
      throw new BadRequestException('Choose an audio or video call.');
    }
    if (!calleeId || callerId === calleeId || calleeId.length > 150) {
      throw new BadRequestException('Invalid call recipient.');
    }

    const [userAId, userBId] = [callerId, calleeId].sort();
    const [friendship, blocked, caller, callee] = await Promise.all([
      this.prisma.friendship.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
        select: { id: true },
      }),
      this.prisma.userBlock.findFirst({
        where: { OR: [
          { blockerId: callerId, blockedId: calleeId },
          { blockerId: calleeId, blockedId: callerId },
        ] },
        select: { blockerId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: callerId }, select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: calleeId }, select: { id: true },
      }),
    ]);

    if (!friendship || !callee || !caller || blocked) {
      throw new ForbiddenException('Calls are only allowed between unblocked Blink friends.');
    }
    // All awaiting requests resume in the same JS event loop, and this check
    // + reservation has no await between it and the map mutation.
    if (this.busy.has(callerId) || this.busy.has(calleeId)) {
      throw new BadRequestException('One of you is already on a call.');
    }

    const call: CallSession = {
      id: randomUUID(),
      callerId, calleeId,
      callerName: caller.name,
      callerSocketId, calleeSocketId: null,
      kind, state: 'ringing', startedAt: Date.now(),
    };
    this.busy.set(callerId, call.id);
    this.busy.set(calleeId, call.id);
    this.calls.set(call.id, call);
    return call;
  }

  find(callId: unknown, userId: string): CallSession {
    if (typeof callId !== 'string' || callId.length > 100) {
      throw new BadRequestException('Invalid call ID.');
    }
    const call = this.calls.get(callId);
    if (!call) throw new NotFoundException('Call has ended.');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException('You cannot access another call.');
    }
    return call;
  }

  accept(callId: unknown, calleeId: string, socketId: string): CallSession {
    const call = this.find(callId, calleeId);
    if (call.calleeId !== calleeId || call.state !== 'ringing') {
      throw new ForbiddenException('This call is no longer ringing for you.');
    }
    call.calleeSocketId = socketId;
    call.acceptedAt = Date.now();
    call.state = 'connected';
    return call;
  }

  peerSocket(callId: unknown, fromId: string, socketId: string): string {
    const call = this.find(callId, fromId);
    if (call.state !== 'connected') {
      throw new BadRequestException('The call was not accepted yet.');
    }
    if (fromId === call.callerId && socketId === call.callerSocketId &&
        call.calleeSocketId) return call.calleeSocketId;
    if (fromId === call.calleeId && socketId === call.calleeSocketId) {
      return call.callerSocketId;
    }
    throw new ForbiddenException('This device is not participating in the call.');
  }

  complete(callId: string): CallSession | null {
    const call = this.calls.get(callId);
    if (!call) return null;
    this.calls.delete(callId);
    if (this.busy.get(call.callerId) === callId) this.busy.delete(call.callerId);
    if (this.busy.get(call.calleeId) === callId) this.busy.delete(call.calleeId);
    return call;
  }

  /**
   * Persist one immutable call-history entry in the existing direct Inbox
   * conversation. Message.mediaType is an unrestricted String field, so this
   * requires no schema migration and cannot be forged through sendMessage.
   * The deterministic ID makes at-least-once recording idempotent.
   */
  async persistOutcome(call: CallSession, reason: string): Promise<void> {
    const endedAt = Date.now();
    const outcome = reason === 'missed' ? 'missed'
      : reason === 'rejected' ? 'declined'
      : reason === 'ended' && call.state === 'ringing' ? 'cancelled'
      : reason === 'disconnected' && call.state === 'ringing' ? 'cancelled'
      : reason === 'disconnected' ? 'dropped'
      : 'completed';
    const durationSeconds = call.acceptedAt
      ? Math.max(0, Math.floor((endedAt - call.acceptedAt) / 1000)) : 0;
    const history = JSON.stringify({
      version: 1, callId: call.id, kind: call.kind,
      outcome, durationSeconds,
    });

    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { members: { some: { userId: call.callerId } } },
            { members: { some: { userId: call.calleeId } } },
            { members: { every: { userId: { in: [call.callerId, call.calleeId] } } } },
          ],
        },
        select: { id: true },
      });
      if (!conversation) return;
      const id = 'blink_call_' + call.id;
      // A retry or duplicated socket disconnect must not create two cards.
      const existing = await tx.message.findUnique({
        where: { id }, select: { id: true },
      });
      if (existing) return;
      await tx.message.create({
        data: {
          id,
          conversationId: conversation.id,
          senderId: call.callerId,
          mediaType: 'call',
          body: history,
        },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date(endedAt) },
      });
    });
  }

  bySocket(socketId: string): CallSession[] {
    return [...this.calls.values()].filter(call =>
      call.callerSocketId === socketId || call.calleeSocketId === socketId);
  }
}
