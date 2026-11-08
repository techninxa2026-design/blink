import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { CallsController } from './calls.controller';

describe('Blink ICE network configuration', () => {
  const req = { user: { userId: 'test-user' } };

  function controller(values: Record<string, string>) {
    const config = {
      get<T>(name: string): T | undefined {
        return values[name] as T | undefined;
      },
    } as unknown as ConfigService;
    return new CallsController(config);
  }

  it('accurately marks the default STUN-only setup as missing TURN', () => {
    const result = controller({}).ice(req);
    expect(result.turnConfigured).toBe(false);
    expect(result.iceServers).toEqual([
      { urls: ['stun:stun.l.google.com:19302'] },
    ]);
  });

  it('does not advertise TURN with a missing or short secret', () => {
    const options = { CALL_TURN_URLS: 'turn:relay.test:3478?transport=udp' };
    for (const secret of ['', 'unsafe']) {
      const result = controller({
        ...options,
        CALL_TURN_SHARED_SECRET: secret,
      }).ice(req);
      expect(result.turnConfigured).toBe(false);
      expect(result.iceServers.some(server =>
        server.urls.some(url => url.startsWith('turn:')))).toBe(false);
    }
  });

  it('issues valid short-lived per-user coturn HMAC credentials', () => {
    const secret = 'valid-random-secret-value-longer-than-16';
    const result = controller({
      CALL_STUN_URLS: 'stun:stun.example.org:3478',
      CALL_TURN_URLS: 'turn:relay.test:3478?transport=udp,turns:relay.test:5349?transport=tcp',
      CALL_TURN_SHARED_SECRET: secret,
    }).ice(req);
    expect(result.turnConfigured).toBe(true);
    const turn = result.iceServers.find(server =>
      server.urls.some(url => url.startsWith('turn:')));
    expect(turn).toBeDefined();
    expect(turn?.urls).toHaveLength(2);
    expect(turn?.username?.endsWith(':test-user')).toBe(true);
    const expires = Number(turn?.username?.split(':')[0]);
    const now = Math.floor(Date.now() / 1000);
    expect(expires).toBeGreaterThan(now + 3500);
    expect(expires).toBeLessThanOrEqual(now + 3605);
    expect(turn?.credential).toBe(createHmac('sha1', secret)
      .update(turn?.username ?? '').digest('base64'));
  });
});
