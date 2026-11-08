import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import type { Namespace, Socket } from 'socket.io';
import { CallsService, type CallSession } from './calls.service';

interface CallPayload {
  callId?: unknown;
  calleeId?: unknown;
  kind?: unknown;
  sdp?: unknown;
  candidate?: unknown;
}

interface CallResult {
  ok: boolean;
  callId?: string;
  error?: string;
}

function allowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Android clients do not send a browser Origin.
  const allowed = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    ...(process.env.CORS_ORIGINS ?? '').split(','),
  ].map(value => value.trim().replace(/\/$/, ''));
  return allowed.includes(origin.replace(/\/$/, ''));
}

@WebSocketGateway({
  namespace: '/calls',
  transports: ['websocket'],
  pingInterval: 20000,
  pingTimeout: 15000,
  cors: {
    origin: (origin: string | undefined, cb: (error: Error | null, allow?: boolean) => void) =>
      allowedOrigin(origin)
        ? cb(null, true) : cb(new Error('Origin not allowed')),
    credentials: false,
  },
})
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Namespace;
  private readonly logger = new Logger(CallsGateway.name);
  private readonly online = new Map<string, Set<string>>();
  private readonly ringingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly calls: CallsService,
    private readonly jwt: JwtService,
  ) {}

  private room(userId: string): string { return `user:${userId}`; }
  private user(client: Socket): string {
    const userId: unknown = client.data.userId;
    if (typeof userId !== 'string' || !userId) throw new Error('Authentication required.');
    return userId;
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const raw: unknown = client.handshake.auth?.token;
      if (typeof raw !== 'string' || raw.length > 10000) throw new Error('Invalid token.');
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; exp: number }>(raw);
      if (typeof payload.sub !== 'string' || !payload.sub || !payload.email) {
        throw new Error('Invalid session.');
      }
      client.data.userId = payload.sub;
      client.join(this.room(payload.sub));
      const sockets = this.online.get(payload.sub) ?? new Set<string>();
      sockets.add(client.id);
      this.online.set(payload.sub, sockets);

      // A socket cannot outlive its JWT, including a long-running call.
      const remaining = payload.exp * 1000 - Date.now();
      if (remaining <= 0) throw new Error('Expired session.');
      const expiration = setTimeout(() => client.disconnect(true), remaining);
      client.once('disconnect', () => clearTimeout(expiration));
    } catch {
      client.emit('call-error', { error: 'Please sign in again.' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId: unknown = client.data.userId;
    if (typeof userId === 'string') {
      const sockets = this.online.get(userId);
      sockets?.delete(client.id);
      if (sockets?.size === 0) this.online.delete(userId);
    }
    for (const call of this.calls.bySocket(client.id)) {
      this.finish(call.id, 'disconnected');
    }
  }

  private fail(error: unknown): CallResult {
    return { ok: false, error: error instanceof Error ? error.message : 'Call unavailable.' };
  }

  private clearRinging(callId: string): void {
    const timeout = this.ringingTimers.get(callId);
    if (timeout) clearTimeout(timeout);
    this.ringingTimers.delete(callId);
  }

  private finish(callId: string, reason: string): void {
    this.clearRinging(callId);
    const call = this.calls.complete(callId);
    if (!call) return;
    const event = { callId, reason };
    this.server.to(this.room(call.callerId)).emit('call-ended', event);
    this.server.to(this.room(call.calleeId)).emit('call-ended', event);
  }

  @SubscribeMessage('call-initiate')
  async initiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallPayload,
  ): Promise<CallResult> {
    try {
      const callerId = this.user(client);
      const calleeId = payload?.calleeId;
      if (typeof calleeId !== 'string' || calleeId.length > 150) {
        return { ok: false, error: 'Invalid recipient.' };
      }
      if (!this.online.get(calleeId)?.size) {
        return { ok: false, error: 'Your friend is not connected. Try again when they are online.' };
      }
      const call = await this.calls.initiate(callerId, calleeId, client.id, payload.kind);
      this.server.to(this.room(calleeId)).emit('call-incoming', {
        callId: call.id, callerId, callerName: call.callerName,
        kind: call.kind, startedAt: call.startedAt,
      });
      this.ringingTimers.set(call.id, setTimeout(() => this.finish(call.id, 'missed'), 35000));
      return { ok: true, callId: call.id };
    } catch (error) {
      return this.fail(error);
    }
  }

  @SubscribeMessage('call-accept')
  accept(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallPayload,
  ): CallResult {
    try {
      const call = this.calls.accept(payload.callId, this.user(client), client.id);
      this.clearRinging(call.id);
      // Other callee devices clear their incoming invitation.
      this.server.to(this.room(call.calleeId)).emit('call-taken', { callId: call.id });
      this.server.to(call.callerSocketId).emit('call-accepted', { callId: call.id });
      return { ok: true, callId: call.id };
    } catch (error) { return this.fail(error); }
  }

  @SubscribeMessage('call-rejected')
  reject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallPayload,
  ): CallResult {
    try {
      const call = this.calls.find(payload.callId, this.user(client));
      if (call.calleeId !== this.user(client) || call.state !== 'ringing') {
        return { ok: false, error: 'Call no longer ringing.' };
      }
      this.finish(call.id, 'rejected');
      return { ok: true };
    } catch (error) { return this.fail(error); }
  }

  @SubscribeMessage('call-ended')
  end(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallPayload,
  ): CallResult {
    try {
      const call = this.calls.find(payload.callId, this.user(client));
      this.finish(call.id, 'ended');
      return { ok: true };
    } catch (error) { return this.fail(error); }
  }

  private forward(
    client: Socket, payload: CallPayload,
    kind: 'call-offer' | 'call-answer' | 'ice-candidate',
  ): CallResult {
    try {
      const callId = payload.callId;
      const peer = this.calls.peerSocket(callId, this.user(client), client.id);
      const contents = kind === 'ice-candidate' ? payload.candidate : payload.sdp;
      const maxSize = kind === 'ice-candidate' ? 8192 : 65536;
      if (contents === null || typeof contents !== 'object' ||
          Array.isArray(contents) || JSON.stringify(contents).length > maxSize) {
        return { ok: false, error: 'Invalid media signal.' };
      }
      if (kind === 'ice-candidate') {
        const candidate = contents as Record<string, unknown>;
        if (typeof candidate.candidate !== 'string') {
          return { ok: false, error: 'Invalid ICE candidate.' };
        }
      } else {
        const description = contents as Record<string, unknown>;
        if (description.type !== (kind === 'call-offer' ? 'offer' : 'answer') ||
            typeof description.sdp !== 'string' || !description.sdp ||
            description.sdp.length > maxSize) {
          return { ok: false, error: 'Invalid SDP description.' };
        }
      }
      this.server.to(peer).emit(kind, { callId, [kind === 'ice-candidate' ? 'candidate' : 'sdp']: contents });
      return { ok: true };
    } catch (error) { return this.fail(error); }
  }

  @SubscribeMessage('call-offer')
  offer(@ConnectedSocket() client: Socket, @MessageBody() payload: CallPayload): CallResult {
    return this.forward(client, payload, 'call-offer');
  }

  @SubscribeMessage('call-answer')
  answer(@ConnectedSocket() client: Socket, @MessageBody() payload: CallPayload): CallResult {
    return this.forward(client, payload, 'call-answer');
  }

  @SubscribeMessage('ice-candidate')
  ice(@ConnectedSocket() client: Socket, @MessageBody() payload: CallPayload): CallResult {
    return this.forward(client, payload, 'ice-candidate');
  }
}
