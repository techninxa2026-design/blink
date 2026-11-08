# Blink Phase 2 — Friend-to-friend voice and video calling

## Implemented architecture

- **NestJS (apps/api)**: CallsModule, CallsService, CallsGateway and CallsController. Socket.IO namespace /calls on the existing API host. JWT verified during namespace handshake, before a socket can emit call events. Room isolation per authenticated member, plus selected-socket checks for every SDP or ICE relay.
- **Web (apps/web)**: React BlinkCalling coordinator and a route-independent calling overlay. Voice / Video actions live in existing private Inbox conversation headers. Browser getUserMedia and RTCPeerConnection carry media directly to the friend.
- **Android (blink-andrid-app / blink_android)**: Flutter WebRTC and socket_io_client. Incoming call overlay above navigation, camera/microphone controls, WebRTC video renderers, and Android native microphone/camera foreground service for an already accepted call.
- **Friendship contract**: Calls require an accepted existing Friendship row; blocked accounts cannot call. Existing REST Inbox messages, friend requests and group conversations are not changed.
- **Call events**: call-initiate, call-incoming, call-accept, call-accepted, call-taken, call-rejected, call-ended, call-offer, call-answer, ice-candidate. Server acknowledgements contain ok/error and a callId on initiation.
- **Safety**: 35-second ringing timeout, one active call per user, session expiration closes socket, no server-side media recording, WebRTC encrypted DTLS-SRTP media channels, no call history database changes.

## Required deployment configuration

Configure on the NestJS server, not in client source:

    JWT_SECRET=<existing authenticated JWT signing secret>
    CORS_ORIGINS=https://<your deployed web origin>
    CALL_STUN_URLS=stun:stun.l.google.com:19302
    CALL_TURN_URLS=turn:<your-turn-host>:3478?transport=udp,turns:<your-turn-host>:5349?transport=tcp
    CALL_TURN_SHARED_SECRET=<random 32-byte or longer secret>

The POST/GET messaging endpoints stay unchanged. GET /calls/ice requires a valid Blink JWT and returns TURN REST-style 1-hour HMAC credentials. Configure coturn using the SAME shared secret with use-auth-secret + static-auth-secret and a working realm. Expose TURN UDP/TCP and the server's relay UDP range. TURN must have routable external IP and firewall/NAT mappings. Never store TURN credentials or JWTs in a Git repository.

The Socket.IO server is reached at wss://<API host>/calls with the default /socket.io transport path. The browser must be hosted over HTTPS (or localhost for development) to use getUserMedia. Android uses the existing --dart-define=BLINK_API_URL environment parameter; React uses VITE_API_URL. Both must reference the SAME API deployment and database for cross-platform calls.

## Native Android

- AndroidManifest declares CAMERA, RECORD_AUDIO, FOREGROUND_SERVICE, FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE and POST_NOTIFICATIONS permissions; it registers BlinkCallForegroundService as non-exported.
- Android requests camera/microphone through WebRTC getUserMedia in the foreground. Only after media permission is granted does MainActivity start the foreground service through the Flutter MethodChannel. The notification keeps a visible, user-accessible ongoing call and opens the application when tapped.
- On Hang up / ended call, the client stops tracks, closes RTCPeerConnection and stops the service. Android API 34+ while-in-use foreground service restrictions mean the service MUST NOT be newly started in the background. Android 13+ notification visibility may require user opt-in.
- The foreground service supports maintaining an ALREADY ACCEPTED active call. It is NOT equivalent to a CallStyle incoming notification, Telecom/ConnectionService, or a push receiver for app-killed incoming calls.

## Smoke test with two accepted friends

1. Install/rebuild the Flutter app and deploy the updated NestJS + React build.
2. Sign into Account A on Android and Account B in a desktop HTTPS browser. Friend request/accept via Blink's existing friendship workflow.
3. In Account A's one-to-one Inbox conversation tap Voice call. Account B should see Incoming and Accept/Decline. Verify microphone audio in both directions.
4. Repeat as Video call. Verify remote video, mute/unmute and camera toggle on both sides.
5. Reject a call, let one ring 35 seconds, and hang up from both sides. All states must clean up and a fresh call must be possible.
6. Verify offline users, unaccepted requests, blocked users, group chats and self-calls cannot start a call.
7. Change networks (Wi-Fi ↔ mobile), test restrictive NAT/firewalls with TURN, and minimize an accepted Android call. Verify foreground notification and eventual disconnect handling.
8. Test JWT expiry, unexpected Wi-Fi loss, simultaneous attempts, and sign-out. The server should close the call and free both participants.

## Deployment and scaling boundaries

- **Current deployment scope**: single-instance NestJS Socket.IO gateway with ephemeral in-process call map and selected active Socket IDs. Do not load-balance multiple NestJS instances until shared Redis call reservations, Socket.IO Redis adapter, distributed expirations/locks and sticky WebSocket routing have been added. The in-memory design is intentionally isolated and does not claim multi-server scalability.
- **Online-only incoming**: the recipient must have an authenticated active Socket.IO session. If the Android app or browser is closed, there is no FCM/APNs push or persistent missed-call delivery. A production push+Android Telecom incoming-call flow is a distinct integration.
- **Network**: STUN-only calling is not reliable over carrier-grade/symmetric NAT; deploy TURN for real-world reliability. TURN bandwidth is not free.
- **Scope**: one-to-one audio/video calls, not groups, call recording, or PSTN. Browser and Android builds must be device-tested; CI compilation alone does not validate NAT traversal, audio route, microphone permissions or background behavior.
- **Session life**: Blink JWTs currently expire after about one hour; their signaling sockets are disconnected on expiry. Token renewal requires an explicit existing-auth enhancement rather than silently bypassing expiration.

## Troubleshooting: media connection failed on Web and Android

**Why ringing still works:** Socket.IO successfully reaches NestJS for call setup, but WebRTC must establish an independent audio/video path using ICE candidates. Blink's default `GET /calls/ice` response only contains STUN unless the API deployment has working `CALL_TURN_URLS` and `CALL_TURN_SHARED_SECRET`. When users are on different mobile/office networks, STUN-only frequently cannot connect. The updated API now includes `turnConfigured: true|false` without disclosing secrets. The clients acknowledge ICE candidate forwarding, buffer early candidates, and attempt one ICE restart, but code cannot replace an actual TURN relay.

### Diagnose without sharing credentials

1. Deploy the latest NestJS and web versions and install the updated Flutter APK; make sure both clients use the same API host and that the WebSocket namespace `/calls` and HTTP endpoint `/calls/ice` reach that host.
2. In an authenticated browser DevTools Network tab, inspect the response to `GET /calls/ice` while starting a call. It must contain `turnConfigured:true` and at least one `turn:` or `turns:` entry for production use. **Do not share the username, credential or JWT** from this response; only check the boolean and URL schemes.
3. If `turnConfigured:false`, set `CALL_TURN_URLS` and `CALL_TURN_SHARED_SECRET` on the **NestJS runtime environment** and restart that server. Do not put these values in React/Vite `VITE_*` variables or Flutter `--dart-define`.
4. If `turnConfigured:true` and ICE still fails, validate that coturn's `use-auth-secret` + `static-auth-secret` equal the NestJS TURN shared secret, and that its public IP, relay UDP port range and TLS certificate are correct. Try the TURN URL and short-lived credentials in the browser WebRTC Trickle ICE test; a working relay produces a **relay** candidate.
5. If a call displays “candidate relay rejected”, inspect NestJS Socket.IO /calls namespace, authentication, WebSocket proxy upgrade, and acknowledgements. A NestJS Socket.IO message ACK is required for the updated apps.
6. Test two friends on the same Wi-Fi first, then Wi-Fi vs mobile data; compare the results. Some networks only permit TURN over TCP/TLS. A public STUN server is **not** a production replacement for TURN.

### Example coturn deployment on a separate Linux relay host

Run coturn on a publicly reachable Linux server (this may be separate from the Blink Node/NestJS host):

```bash
sudo apt update
sudo apt install -y coturn
sudo systemctl enable --now coturn
```

Sample `/etc/turnserver.conf` (replace example DNS, public IPv4 and secret with your real settings; never commit the real secret):

```ini
listening-port=3478
fingerprint
realm=turn.example.com
use-auth-secret
static-auth-secret=REPLACE_WITH_A_LONG_RANDOM_PRIVATE_SECRET
external-ip=203.0.113.10
min-port=49160
max-port=49200
no-cli
no-multicast-peers
```

Open inbound **3478 UDP/TCP** and **49160–49200 UDP** on the relay firewall/security group and underlying host; if you enable `turns:`, additionally configure a valid TLS certificate/key, `tls-listening-port=5349`, and open 5349 TCP. If coturn runs behind NAT, configure the appropriate `external-ip=PUBLIC/PRIVATE` mapping. For real production traffic choose a larger relay UDP range based on expected concurrent calls.

Set the Blink NestJS environment (example; real values must stay private):

```env
CALL_STUN_URLS=stun:stun.l.google.com:19302
CALL_TURN_URLS=turn:turn.example.com:3478?transport=udp
CALL_TURN_SHARED_SECRET=REPLACE_WITH_THE_SAME_LONG_RANDOM_PRIVATE_SECRET
```

Restart coturn and the Blink NestJS service. Check `GET /calls/ice` again. Its `turnConfigured` flag only proves that the API **returns** TURN configuration; only an actual gathered relay candidate and real device call prove that TURN is reachable. Neither compilation nor an HTTP 200 response can validate NAT traversal.

### What the retry addresses

An ICE candidate may be delivered before the remote SDP has been applied. The clients retain and flush early candidates. ICE candidates are now sent with Socket.IO acknowledgements, and the browser/Android use a single ICE restart before reporting failure. The original caller creates restart offers to avoid both peers negotiating simultaneously; the callee requests the restart via the authenticated `call-ice-restart-request` event. The server still authorizes all signals to the already selected participants in a single authenticated one-to-one call. This improves resilience but does not make a STUN-only setup reliable.

## Acoustic echo troubleshooting (voice repeats during an otherwise connected call)

Echo is different from an ICE/TURN problem. A call that has working audio can echo when the remote loudspeaker is recaptured by that device's microphone. Acoustic echo cancellation (AEC) depends on both the hardware and audio route; no software processing guarantees silence with two nearby loudspeakers.

- **Flutter Android:** voice calls now request WebRTC echo cancellation, noise suppression, automatic microphone gain and mono capture. Before opening media, they select Android's voice communication configuration. Voice starts on the earpiece rather than loudspeaker; video starts on speakerphone. The call overlay has an **Earpiece/Speaker on** button. The selected route is reapplied when the remote audio track becomes available and released when the call ends.
- **React browser:** microphone constraints request AEC, noise suppression, AGC, and preferred mono input. The app maintains a muted local preview and lowers its single remote playback element to 78% volume. The browser may ignore unsupported constraints or provide hardware-specific behavior.
- **How to verify:** Update both clients; test one web account and one Android account in different rooms, or use wired/Bluetooth headphones on one side. Make sure the web account does not also have a second audible Blink tab open. If the echo disappears using headphones, it was acoustic feedback—not duplicate network packets or TURN signaling.
- **If only video speakerphone echoes:** lower the hardware speaker volume, use headphones or toggle Android to the earpiece. If echo continues with headsets on both sides, check browser microphone settings, audio enhancements, and the Android device's OS-level audio processing.
- **Scope:** These changes leave friendship checks, call signaling, ICE/TURN setup, and private message behavior unchanged.
