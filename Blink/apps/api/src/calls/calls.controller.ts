import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { userId: string };
}
interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly config: ConfigService) {}

  @Get('ice')
  ice(@Req() request: AuthenticatedRequest): {
    iceServers: IceServerConfig[];
    turnConfigured: boolean;
  } {
    const urls = (value: string) => value.split(',').map(v => v.trim()).filter(Boolean);
    const stun = urls(this.config.get<string>('CALL_STUN_URLS') ??
      'stun:stun.l.google.com:19302');
    const iceServers: IceServerConfig[] = [];
    if (stun.length) iceServers.push({ urls: stun });

    // TURN REST-style ephemeral credentials (coturn use-auth-secret).
    // Never embed static long-lived TURN credentials in either frontend.
    const turnUrls = urls(this.config.get<string>('CALL_TURN_URLS') ?? '');
    const sharedSecret = this.config.get<string>('CALL_TURN_SHARED_SECRET') ?? '';
    if (turnUrls.length && sharedSecret.length >= 16) {
      const username = `${Math.floor(Date.now() / 1000) + 3600}:${request.user.userId}`;
      const credential = createHmac('sha1', sharedSecret)
        .update(username).digest('base64');
      iceServers.push({ urls: turnUrls, username, credential });
    }
    // Report deployment capability, never any TURN shared secret.
    // A STUN-only result can ring and answer but still fail ICE across NATs.
    return { iceServers, turnConfigured: turnUrls.length > 0 && sharedSecret.length >= 16 };
  }
}
