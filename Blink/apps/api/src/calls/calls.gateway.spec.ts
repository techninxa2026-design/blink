import { ForbiddenException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Namespace, Socket } from 'socket.io';
import type { CallsService } from './calls.service';
import { CallsGateway } from './calls.gateway';

describe('Call ICE signaling and authorized restart', () => {
  function fixture(authorized = true) {
    const packets: Array<{ event: string; body: unknown }> = [];
    const destinations: string[] = [];
    const calls = {
      peerSocket: (callId: unknown, userId: string, deviceId: string) => {
        if (!authorized || callId !== 'call-1' ||
            userId !== 'alice' || deviceId !== 'socket-a') {
          throw new ForbiddenException('Device not authorized to signal.');
        }
        return 'socket-b';
      },
    } as unknown as CallsService;
    const gateway = new CallsGateway(calls, {} as JwtService);
    gateway.server = {
      to(room: string) {
        destinations.push(room);
        return {
          emit(event: string, body: unknown) {
            packets.push({ event, body });
          },
        };
      },
    } as unknown as Namespace;
    const client = { id: 'socket-a', data: { userId: 'alice' } } as Socket;
    return { gateway, client, packets, destinations };
  }

  it('relays valid ICE candidates solely to the active peer socket', () => {
    const { gateway, client, packets, destinations } = fixture();
    const candidate = {
      candidate: 'candidate:0 1 udp 2113937151 192.0.2.4 54321 typ host',
      sdpMid: '0', sdpMLineIndex: 0,
    };
    expect(gateway.ice(client, { callId: 'call-1', candidate }))
      .toEqual({ ok: true });
    expect(destinations).toEqual(['socket-b']);
    expect(packets).toEqual([{
      event: 'ice-candidate', body: { callId: 'call-1', candidate },
    }]);
  });

  it('rejects invalid candidate shapes without forwarding', () => {
    const { gateway, client, packets } = fixture();
    expect(gateway.ice(client, {
      callId: 'call-1', candidate: { candidate: 24 },
    }).ok).toBe(false);
    expect(packets).toHaveLength(0);
  });

  it('refuses ICE and restart forwarding by an unauthorized socket', () => {
    const { gateway, client, packets } = fixture(false);
    expect(gateway.ice(client, {
      callId: 'call-1', candidate: { candidate: 'candidate:x' },
    }).ok).toBe(false);
    expect(gateway.requestIceRestart(client, { callId: 'call-1' }).ok)
      .toBe(false);
    expect(packets).toHaveLength(0);
  });

  it('forwards a restart request only to the selected other participant', () => {
    const { gateway, client, packets, destinations } = fixture();
    expect(gateway.requestIceRestart(client, { callId: 'call-1' }))
      .toEqual({ ok: true });
    expect(destinations).toEqual(['socket-b']);
    expect(packets).toEqual([{
      event: 'call-ice-restart-request',
      body: { callId: 'call-1' },
    }]);
  });
});
