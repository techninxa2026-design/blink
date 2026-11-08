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
