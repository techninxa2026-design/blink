import { useEffect, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCIAL_API_URL } from './blinkSocialApi';
import './BlinkCalling.css';

export type BlinkCallKind = 'audio' | 'video';
type CallStatus = 'idle' | 'starting' | 'incoming' | 'ringing' | 'connecting' | 'connected';
interface Snapshot {
  status: CallStatus;
  callId: string;
  peerId: string;
  peerName: string;
  kind: BlinkCallKind;
  muted: boolean;
  cameraOff: boolean;
  local: MediaStream | null;
  remote: MediaStream | null;
  error: string;
}
interface Ack { ok: boolean; callId?: string; error?: string }
interface Signal { callId: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
interface Invite {
  callId: string; callerId: string; callerName: string; kind: BlinkCallKind;
}
const idle: Snapshot = {
  status: 'idle', callId: '', peerId: '', peerName: '', kind: 'audio',
  muted: false, cameraOff: false, local: null, remote: null, error: '',
};

class Calling {
  private socket: Socket | null = null;
  private token = '';
  private state: Snapshot = idle;
  private pc: RTCPeerConnection | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private readonly listeners = new Set<() => void>();
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  snapshot = () => this.state;
  private change(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }

  connect(token: string | null): void {
    if (!token) { this.disconnect(); return; }
    if (token === this.token && this.socket) return;
    this.disconnect();
    this.token = token;
    const socket = io(SOCIAL_API_URL + '/calls', {
      auth: { token }, transports: ['websocket'],
      reconnection: true, reconnectionDelay: 800,
      reconnectionDelayMax: 5000, forceNew: true,
      timeout: 10000,
    });
    this.socket = socket;

    socket.on('call-incoming', (invite: Invite) => {
      if (!invite?.callId || !invite.callerId ||
          !['audio', 'video'].includes(invite.kind)) return;
      if (this.state.status !== 'idle') {
        socket.emit('call-rejected', { callId: invite.callId });
        return;
      }
      this.change({ status: 'incoming', callId: invite.callId,
        peerId: invite.callerId, peerName: invite.callerName || 'Blink friend',
        kind: invite.kind, error: '' });
    });
    socket.on('call-taken', (event: {callId: string}) => {
      if (event.callId === this.state.callId && this.state.status === 'incoming') {
        this.clear();
      }
    });
    socket.on('call-accepted', (event: {callId: string}) => {
      if (event.callId === this.state.callId && this.state.status === 'ringing') {
        void this.createOffer().catch(error => this.fail(error));
      }
    });
    socket.on('call-offer', (signal: Signal) => {
      if (signal.callId === this.state.callId && signal.sdp) {
        void this.answerOffer(signal.sdp).catch(error => this.fail(error));
      }
    });
    socket.on('call-answer', (signal: Signal) => {
      if (signal.callId === this.state.callId && signal.sdp) {
        void this.receiveAnswer(signal.sdp).catch(error => this.fail(error));
      }
    });
    socket.on('ice-candidate', (signal: Signal) => {
      if (signal.callId === this.state.callId && signal.candidate) {
        void this.receiveIce(signal.candidate).catch(error => this.fail(error));
      }
    });
    socket.on('call-ended', (event: {callId: string}) => {
      if (event.callId === this.state.callId) this.clear();
    });
    socket.on('disconnect', () => {
      if (this.state.status !== 'idle') this.clear('Call connection interrupted.');
    });
    socket.on('call-error', (event: {error?: string}) => {
      if (event.error) this.change({ error: event.error });
    });
  }

  disconnect() {
    this.clear();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.token = '';
  }

  private ack(event: string, data: Record<string, unknown>): Promise<Ack> {
    const socket = this.socket;
    if (!socket?.connected) {
      return Promise.reject(new Error('Calling service offline. Reconnect and try again.'));
    }
    return new Promise((resolve, reject) => {
      socket.timeout(9000).emit(event, data,
        (error: Error | null, result?: Ack) => {
          if (error) reject(new Error('Calling request timed out.'));
          else if (!result?.ok) reject(new Error(result?.error || 'Call rejected.'));
          else resolve(result);
        });
    });
  }

  private async waitConnected(): Promise<void> {
    for (let attempt = 0; attempt < 35; attempt++) {
      if (this.socket?.connected) return;
      await new Promise<void>(resolve => window.setTimeout(resolve, 200));
    }
    throw new Error('Calling service is offline. Please reconnect.');
  }

  async start(peerId: string, peerName: string, kind: BlinkCallKind) {
    if (this.state.status !== 'idle') return;
    this.change({ ...idle, status: 'starting', peerId, peerName, kind });
    try {
      await this.waitConnected();
      if (this.snapshot().status !== 'starting') return;
      const result = await this.ack('call-initiate', { calleeId: peerId, kind });
      if (!result.callId) throw new Error('Call identifier missing.');
      // Hang-up may have happened before the server returned the call ID.
      // Release its reservation rather than resurrecting a cancelled call.
      if (this.snapshot().status !== 'starting') {
        this.socket?.emit('call-ended', { callId: result.callId });
        return;
      }
      this.change({ status: 'ringing', callId: result.callId });
    } catch (error) {
      this.clear(error instanceof Error ? error.message : 'Call unavailable.');
    }
  }

  async accept() {
    if (this.state.status !== 'incoming') return;
    const callId = this.state.callId;
    this.change({ status: 'connecting' });
    try {
      await this.prepare(callId);
      if (this.state.callId !== callId) return;
      await this.ack('call-accept', { callId });
    } catch (error) {
      this.socket?.emit('call-rejected', { callId });
      this.clear(error instanceof Error ? error.message : 'Microphone permission denied.');
    }
  }

  reject() {
    if (this.state.callId) this.socket?.emit('call-rejected', {callId: this.state.callId});
    this.clear();
  }
  hangUp() {
    if (this.state.callId) this.socket?.emit('call-ended', {callId: this.state.callId});
    this.clear();
  }
  dismiss() { this.change({ error: '' }); }
  toggleMute() {
    const muted = !this.state.muted;
    this.state.local?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    this.change({ muted });
  }
  toggleCamera() {
    const cameraOff = !this.state.cameraOff;
    this.state.local?.getVideoTracks().forEach(track => { track.enabled = !cameraOff; });
    this.change({ cameraOff });
  }

  private async prepare(callId: string) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Calls require HTTPS or localhost and device permissions.');
    }
    const response = await fetch(SOCIAL_API_URL + '/calls/ice', {
      headers: { Authorization: 'Bearer ' + this.token }, cache: 'no-store',
    });
    if (!response.ok) throw new Error('Cannot retrieve calling network settings.');
    const { iceServers } = await response.json() as { iceServers: RTCIceServer[] };
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: this.state.kind === 'video'
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    });
    if (this.state.callId !== callId) {
      media.getTracks().forEach(track => track.stop());
      return;
    }
    const pc = new RTCPeerConnection({ iceServers });
    this.pc = pc;
    this.pendingIce = [];
    const remote = new MediaStream();
    // Keep the caller identity visible until a remote media track arrives.
    this.change({ local: media });
    media.getTracks().forEach(track => pc.addTrack(track, media));
    pc.ontrack = event => {
      if (event.streams[0]) this.change({ remote: event.streams[0] });
      else { remote.addTrack(event.track); this.change({ remote }); }
    };
    pc.onicecandidate = event => {
      if (event.candidate && this.state.callId === callId) {
        this.socket?.emit('ice-candidate', {
          callId, candidate: event.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.state.callId !== callId) return;
      if (pc.connectionState === 'connected') {
        if (this.connectionTimer) clearTimeout(this.connectionTimer);
        this.connectionTimer = null;
        this.change({ status: 'connected' });
      } else if (pc.connectionState === 'failed') {
        this.fail(new Error('Media connection failed. Check your network.'));
      }
    };
    this.connectionTimer = setTimeout(() => {
      if (this.state.callId === callId && this.state.status !== 'connected') {
        this.fail(new Error('Media connection timed out. A TURN server may be required.'));
      }
    }, 30000);
  }

  private async createOffer() {
    const id = this.state.callId;
    this.change({ status: 'connecting' });
    await this.prepare(id);
    if (!this.pc || this.state.callId !== id) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.ack('call-offer', { callId: id,
      sdp: { type: offer.type, sdp: offer.sdp } });
  }

  private async answerOffer(sdp: RTCSessionDescriptionInit) {
    const pc = this.pc;
    if (!pc) throw new Error('Media is not ready yet.');
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.flushIce();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.ack('call-answer', { callId: this.state.callId,
      sdp: { type: answer.type, sdp: answer.sdp } });
  }

  private async receiveAnswer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) throw new Error('Media peer unavailable.');
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.flushIce();
  }

  private async receiveIce(candidate: RTCIceCandidateInit) {
    if (!this.pc?.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
  private async flushIce() {
    const all = [...this.pendingIce];
    this.pendingIce = [];
    for (const candidate of all) await this.receiveIce(candidate);
  }
  private fail(error: unknown) {
    const reason = error instanceof Error ? error.message : 'Call failed.';
    this.hangUp();
    this.change({ error: reason });
  }
  private clear(error = '') {
    if (this.connectionTimer) clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
    const pc = this.pc;
    this.pc = null;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    this.state.local?.getTracks().forEach(track => track.stop());
    this.pendingIce = [];
    this.change({ ...idle, error });
  }
}

export const blinkCalls = new Calling();

export function BlinkCallingHost() {
  const state = useSyncExternalStore(blinkCalls.subscribe, blinkCalls.snapshot);
  useEffect(() => {
    const local = document.getElementById('blink-call-local') as HTMLVideoElement | null;
    const remote = document.getElementById('blink-call-remote') as HTMLVideoElement | null;
    const audio = document.getElementById('blink-call-audio') as HTMLAudioElement | null;
    if (local) local.srcObject = state.local;
    if (remote) remote.srcObject = state.remote;
    if (audio) audio.srcObject = state.remote;
  }, [state.local, state.remote, state.status, state.kind]);
  if (state.status === 'idle') {
    return state.error ? <div className="blink-call-notice" role="alert">
      {state.error}<button type="button" onClick={() => blinkCalls.dismiss()}>Dismiss</button>
    </div> : null;
  }
  return <div className="blink-call-scrim" role="dialog" aria-modal="true"
    aria-label={state.kind === 'video' ? 'Blink video call' : 'Blink audio call'}>
    <section className="blink-call-panel">
      <div className="blink-call-top">
        <span>✦ BLINK CONNECT</span>
        <span>{state.kind === 'video' ? 'VIDEO' : 'VOICE'}</span>
      </div>
      <div className="blink-call-stage">
        {state.kind === 'video' && state.remote &&
          <video id="blink-call-remote" autoPlay playsInline className="blink-call-remote" />}
        {state.kind === 'audio' && state.remote &&
          <audio id="blink-call-audio" autoPlay />}
        {state.kind === 'video' && state.local &&
          <video id="blink-call-local" autoPlay playsInline muted className="blink-call-local" />}
        {(!state.remote || state.kind === 'audio') && <div className="blink-call-person">
          <div className="blink-call-avatar">{state.peerName.charAt(0).toUpperCase()}</div>
          <h2>{state.peerName}</h2>
          <p>{state.status === 'incoming' ? 'Incoming call' :
            state.status === 'starting' ? 'Preparing call…' :
            state.status === 'ringing' ? 'Ringing…' :
            state.status === 'connecting' ? 'Connecting securely…' :
            'Connected'}</p>
        </div>}
      </div>
      <div className="blink-call-actions">
        {state.status === 'incoming' ? <>
          <button type="button" className="blink-call-decline"
            onClick={() => blinkCalls.reject()}>✕ Decline</button>
          <button type="button" className="blink-call-accept"
            onClick={() => void blinkCalls.accept()}>✓ Answer</button>
        </> : <>
          {(state.status === 'connecting' || state.status === 'connected') &&
            <button type="button" onClick={() => blinkCalls.toggleMute()}
              aria-pressed={state.muted}>{state.muted ? 'Unmute' : 'Mute'}</button>}
          {state.kind === 'video' && state.local &&
            <button type="button" onClick={() => blinkCalls.toggleCamera()}
              aria-pressed={state.cameraOff}>{state.cameraOff ? 'Camera on' : 'Camera off'}</button>}
          <button type="button" className="blink-call-decline"
            onClick={() => blinkCalls.hangUp()}>End call</button>
        </>}
      </div>
    </section>
  </div>;
}
